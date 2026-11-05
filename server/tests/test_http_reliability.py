import json
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.auth.jwt import UserInfo, get_current_user
from app.config import settings
from app.database import SCHEMA, independent_db
from app.main import app
from app.harness.observability import trace_id
from app.workers.jobs import claim, ReviewWorker


class HttpReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        directory = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.stack.enter_context(patch.object(settings, "database_path", Path(directory) / "test.db"))
        self.stack.enter_context(patch.object(settings, "trace_dir", Path(directory) / "traces"))
        self.stack.enter_context(patch.object(settings, "harness_runtime_enabled", False))
        for module in ("app.api.sessions", "app.api.analysis", "app.services.report"):
            self.stack.enter_context(patch(f"{module}.db", independent_db))
        with independent_db() as conn:
            conn.executescript(SCHEMA)
            conn.execute("INSERT INTO sessions VALUES ('s','u','scenario','test','active',NULL,'t','t')")
            conn.execute("INSERT INTO messages(id,session_id,role,content,created_at) VALUES ('m','s','user','您好','t')")
            conn.execute("INSERT INTO scenarios(id,data) VALUES ('scenario',?)", (json.dumps({
                "title": "测试场景", "description": "了解需求", "maxTurns": 2,
                "npc": {"name": "测试客户"}, "goals": [{"id": "g", "description": "询问预算"}],
            }),))
        app.dependency_overrides[get_current_user] = lambda: UserInfo(user_id="u", nickname="测试", is_admin=False)
        self.addCleanup(app.dependency_overrides.clear)
        # No lifespan: HTTP tests must not start background jobs or seed real data.
        self.client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)

    def test_complete_queues_once_and_carries_trace(self):
        response = self.client.post("/sessions/s/complete")
        self.assertEqual(response.status_code, 200)
        first_trace = response.headers["X-Trace-ID"]
        self.assertEqual(self.client.post("/sessions/s/complete").status_code, 200)
        with independent_db() as conn:
            jobs = conn.execute("SELECT * FROM jobs").fetchall()
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0]["trace_id"], first_trace)

    def test_active_review_is_rejected_without_job(self):
        self.assertEqual(self.client.post("/sessions/s/analysis-retry").status_code, 409)
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0], 0)

    def test_owner_and_login_are_required(self):
        app.dependency_overrides[get_current_user] = lambda: UserInfo(user_id="other", nickname="他人", is_admin=False)
        self.assertEqual(self.client.post("/sessions/s/analysis-retry").status_code, 403)
        app.dependency_overrides.clear()
        self.assertIn(self.client.post("/sessions/s/complete").status_code, (401, 403))

    def test_failed_result_stays_failed_until_explicit_retry(self):
        self.client.post("/sessions/s/complete")
        with independent_db() as conn:
            conn.execute("UPDATE jobs SET status='dead'")
            conn.execute("UPDATE analysis_reports SET status='failed'")
        self.assertEqual(self.client.get("/sessions/s/analysis-status").json()["status"], "failed")
        self.assertEqual(self.client.get("/sessions/s/analysis-results").json()["status"], "failed")
        self.assertEqual(self.client.post("/sessions/s/analysis-retry").json()["status"], "processing")

    def test_unexpected_errors_are_redacted_and_traceable(self):
        with patch("app.api.sessions.enqueue_review", side_effect=RuntimeError("private-key-and-path")):
            response = self.client.post("/sessions/s/complete")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private-key", response.text)
        self.assertTrue(response.headers["X-Trace-ID"])
        records = [json.loads(line) for path in settings.trace_dir.glob("events-*.jsonl")
                   for line in path.read_text().splitlines()]
        self.assertNotIn("private-key", json.dumps(records))
        self.assertIn(response.headers["X-Trace-ID"], [r["trace_id"] for r in records])

    def test_cors_denies_unlisted_origin(self):
        headers = {"Origin": "https://untrusted.invalid", "Access-Control-Request-Method": "POST"}
        denied = self.client.options("/sessions/s/complete", headers=headers)
        self.assertEqual(denied.status_code, 400)
        self.assertNotIn("access-control-allow-origin", denied.headers)
        headers["Origin"] = settings.cors_origins[0]
        allowed = self.client.options("/sessions/s/complete", headers=headers)
        self.assertEqual(allowed.headers["access-control-allow-origin"], settings.cors_origins[0])

    def _business_reply(self, *, incomplete=False, **kwargs):
        self.assertEqual(kwargs["label"], "business-review")
        payload = json.loads(kwargs["messages"][0]["content"])
        messages = payload["messages"]
        user_message = next(m for m in messages if m["role"] == "user" and "预算" in m["content"])
        customer_message = next(m for m in messages if m["role"] == "npc")
        evidence = [{"messageId": m["id"], "speaker": m["role"], "quote": m["content"]}
                    for m in (user_message, customer_message)]
        criteria = []
        for definition in payload["rubric"]["criteria"]:
            criterion_id = definition["id"]
            status = "not_applicable" if criterion_id == "S4" else "assessed"
            if incomplete and criterion_id == "S3":
                status = "insufficient_evidence"
            criteria.append({
                "id": criterion_id, "status": status,
                "score": (1 if criterion_id == "S2" else 0) if status == "assessed" else None,
                "reason": "询问了预算，但未核实影响与优先级。" if criterion_id == "S2" else "当前对话未提供完成此动作的证据。",
                "evidence": evidence if status == "assessed" else [],
                "checkedRange": {"firstMessageId": messages[0]["id"], "lastMessageId": messages[-1]["id"]},
                "missingBehavior": "进一步确认采购时间。", "nextPractice": "练习询问采购时间并核对安排。",
                "opportunity": "absent" if criterion_id == "S4" else None,
            })
        return json.dumps({"criteria": criteria, "risks": []}, ensure_ascii=False)

    def test_turn_auto_complete_worker_and_cached_report_full_path(self):
        model_traces = []
        def model(**kwargs):
            model_traces.append(trace_id.get())
            if kwargs["label"] == "npc-conversation":
                return "年度预算五万元。"
            return json.dumps({"angerLevel": 1, "trustLevel": 6, "progressLevel": 4,
                               "goalUpdates": [{"goalId": "g", "achieved": True, "reason": "已询问预算"}]})
        with patch("app.services.conversation.call_model", side_effect=model):
            response = self.client.post("/sessions/s/messages", json={"content": "请问预算是多少？"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["sessionCompleted"])
        self.assertEqual(model_traces, [response.headers["X-Trace-ID"]] * 2)
        with patch("app.services.business_review.call_model", side_effect=self._business_reply) as report_model:
            ReviewWorker().run(claim())
            self.assertEqual(report_model.call_count, 1)
            result = self.client.get("/sessions/s/analysis-results").json()
            self.assertEqual(self.client.get("/sessions/s/analysis-results").json(), result)
            self.assertEqual(report_model.call_count, 1, "Cached reports must not call the model again")
        # Only discovery scored 1/2; no objection opportunity means 15 / 80 * 100 = 19.
        self.assertEqual(result["feedback"]["scores"]["overall"], 19)
        business = result["businessReview"]
        self.assertEqual(business["totalScore"], 19)
        self.assertEqual(business["status"], "completed")
        self.assertEqual(business["criteria"][0]["score"], 0)
        self.assertEqual(business["criteria"][3]["status"], "not_applicable")
        self.assertIsNone(business["criteria"][3]["score"])
        self.assertEqual(result["rubricSnapshot"]["rubricVersion"], business["rubricVersion"])
        source_messages = {m["messageId"]: m for m in result["messages"]}
        for evidence in business["criteria"][1]["evidence"]:
            self.assertEqual(source_messages[evidence["messageId"]]["sender"], evidence["speaker"])
            self.assertEqual(source_messages[evidence["messageId"]]["content"], evidence["quote"])
        self.assertEqual(result["goalResults"]["goalStatuses"][0]["description"], "询问预算")
        self.assertNotIn("detailedAnalysis", result["feedback"])
        self.assertEqual(self.client.post("/sessions/s/analysis-retry").json()["status"], "completed")
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0], 3)
            self.assertEqual(conn.execute("SELECT attempt FROM jobs").fetchone()[0], 1)

    def test_worker_caches_incomplete_business_review_without_default_total(self):
        with independent_db() as conn:
            conn.execute("UPDATE messages SET content='请问预算是多少？' WHERE id='m'")
            conn.execute("INSERT INTO messages(id,session_id,role,content,created_at) VALUES ('customer','s','npc','预算五万元。','u')")
        self.assertEqual(self.client.post("/sessions/s/complete").status_code, 200)
        with patch("app.services.business_review.call_model", side_effect=lambda **kw: self._business_reply(incomplete=True, **kw)) as model:
            ReviewWorker().run(claim())
            result = self.client.get("/sessions/s/analysis-results").json()
            self.assertIsNone(result["feedback"]["scores"]["overall"])
            self.assertIsNone(result["businessReview"]["totalScore"])
            self.assertEqual(result["businessReview"]["status"], "incomplete")
            self.assertEqual(result["businessReview"]["criteria"][2]["status"], "insufficient_evidence")
            self.assertEqual(self.client.get("/sessions/s/analysis-status").json()["status"], "completed")
            self.assertEqual(self.client.get("/sessions/s/analysis-results").json(), result)
            self.assertEqual(model.call_count, 1)

    def test_late_model_reply_cannot_change_completed_session(self):
        def late_model(**kwargs):
            if kwargs["label"] == "npc-conversation":
                with independent_db() as conn:
                    conn.execute("UPDATE sessions SET status='completed'")
                return "迟到的回复"
            return "{}"
        with patch("app.services.conversation.call_model", side_effect=late_model):
            response = self.client.post("/sessions/s/messages", json={"content": "刚才的问题"})
        self.assertTrue(response.json()["sessionCompleted"], response.text)
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0], 1)
