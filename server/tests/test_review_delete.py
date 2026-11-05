import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth.jwt import UserInfo, get_current_user
from app.config import settings
from app.database import SCHEMA, independent_db
from app.harness.state import PracticeState, save_state
from app.main import app
from app.workers import jobs


class ReviewDeleteTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        folder = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.stack.enter_context(patch.object(settings, "database_path", Path(folder) / "reviews.db"))
        self.stack.enter_context(patch.object(settings, "trace_dir", Path(folder) / "traces"))
        for module in ("app.api.reviews", "app.api.sessions", "app.api.analysis", "app.services.report"):
            self.stack.enter_context(patch(f"{module}.db", independent_db))
        self.user = UserInfo(user_id="owner", nickname="测试用户", is_admin=False)
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)
        self.scene = {"id": "scene", "title": "测试场景", "description": "了解客户顾虑",
                      "npc": {"name": "客户"}, "goals": [], "maxTurns": 10}
        with independent_db() as conn:
            conn.executescript(SCHEMA)
            conn.execute("INSERT INTO scenarios(id,data) VALUES ('scene',?)", (json.dumps(self.scene),))
        for source in ("practice", "chat", "audio"):
            self.seed(source, source=source)
        self.seed("foreign", user_id="other")

    def seed(self, sid, source="practice", user_id="owner", status="completed"):
        with independent_db() as conn:
            conn.execute("INSERT INTO sessions VALUES (?,?,?,?,?,NULL,'t','t')",
                         (sid, user_id, "scene", f"记录-{sid}", status))
            conn.execute("INSERT INTO messages(id,session_id,role,content,created_at) VALUES (?,?,'user','你好','t')",
                         (f"message-{sid}", sid))
            conn.execute("INSERT INTO analysis_reports VALUES (?,'completed','{}',NULL,'t','t')", (sid,))
            conn.execute("INSERT INTO jobs(id,type,resource_id,trace_id,status,max_attempts,next_run_at,created_at,updated_at) "
                         "VALUES (?,'review',?,'trace','completed',3,0,'t','t')", (f"job-{sid}", sid))
            conn.execute("INSERT INTO tool_audits(id,trace_id,session_id,user_id,tool,effect,status,argument_bytes,created_at) "
                         "VALUES (?,'trace',?,?,'read','read','completed',0,0)", (f"audit-{sid}", sid, user_id))
            if source != "practice":
                conn.execute("INSERT INTO review_imports VALUES (?,?,'背景')", (sid, source))
            save_state(conn, PracticeState(sessionId=sid, userId=user_id, scenarioId="scene", scenario=self.scene))

    def counts(self, sid):
        with independent_db() as conn:
            values = {table: conn.execute(f"SELECT COUNT(*) FROM {table} WHERE session_id=?", (sid,)).fetchone()[0]
                      for table in ("messages", "analysis_reports", "review_imports", "session_states", "tool_audits")}
            values["sessions"] = conn.execute("SELECT COUNT(*) FROM sessions WHERE id=?", (sid,)).fetchone()[0]
            values["jobs"] = conn.execute("SELECT COUNT(*) FROM jobs WHERE resource_id=?", (sid,)).fetchone()[0]
            return values

    def test_each_source_deletes_only_target_and_its_related_data(self):
        foreign = self.counts("foreign")
        for source in ("practice", "chat", "audio"):
            with self.subTest(source=source):
                result = self.client.delete(f"/reviews/{source}")
                self.assertEqual(result.status_code, 200, result.text)
                self.assertTrue(result.json()["success"])
                self.assertTrue(all(count == 0 for count in self.counts(source).values()))
                self.assertEqual(self.counts("foreign"), foreign)
                self.assertEqual(self.client.get(f"/sessions/{source}").status_code, 404)
                self.assertEqual(self.client.get(f"/sessions/{source}/analysis-status").status_code, 404)
                self.assertEqual(self.client.post(f"/sessions/{source}/complete").status_code, 404)
                self.assertEqual(self.client.get(f"/reviews/{source}").status_code, 404)
        self.assertEqual(self.client.get("/reviews").json()["total"], 0)
        with independent_db() as conn:
            self.assertIsNotNone(conn.execute("SELECT 1 FROM scenarios WHERE id='scene'").fetchone())

    def test_unauthorized_missing_and_repeated_delete_cannot_remove_other_data(self):
        expected = self.counts("foreign")
        self.assertEqual(self.client.delete("/reviews/foreign").status_code, 404)
        self.assertEqual(self.counts("foreign"), expected)
        self.assertEqual(self.client.delete("/reviews/missing").status_code, 404)
        self.assertEqual(self.client.delete("/reviews/practice").status_code, 200)
        self.assertEqual(self.client.delete("/reviews/practice").status_code, 404)
        app.dependency_overrides.clear()
        self.assertEqual(self.client.delete("/reviews/chat").status_code, 401)
        self.assertEqual(self.counts("chat")["sessions"], 1)

    def test_delete_rolls_back_all_cleanup_on_failure(self):
        before = self.counts("practice")
        with independent_db() as conn:
            conn.execute("CREATE TRIGGER fail_cleanup BEFORE DELETE ON messages "
                         "WHEN OLD.session_id='practice' BEGIN SELECT RAISE(ABORT,'test failure'); END")
        self.assertEqual(self.client.delete("/reviews/practice").status_code, 500)
        self.assertEqual(self.counts("practice"), before)

    def test_late_worker_enqueue_and_state_save_cannot_recreate_deleted_records(self):
        with independent_db() as conn:
            conn.execute("UPDATE jobs SET status='pending' WHERE resource_id='practice'")
            conn.execute("UPDATE analysis_reports SET status='pending' WHERE session_id='practice'")
        job = jobs.claim()
        self.assertEqual(job["resource_id"], "practice")
        self.assertEqual(self.client.delete("/reviews/practice").status_code, 200)
        self.assertFalse(jobs.finish(job, result={"late": True}))
        with independent_db() as conn:
            with self.assertRaises(HTTPException) as cm:
                jobs.enqueue_review(conn, "practice", retry=True)
            self.assertEqual(cm.exception.status_code, 404)
        with independent_db() as conn:
            with self.assertRaises(ValueError):
                save_state(conn, PracticeState(sessionId="practice", userId="owner", scenarioId="scene", scenario=self.scene))
        self.assertTrue(all(count == 0 for count in self.counts("practice").values()))

    def test_deleting_active_session_while_model_runs_discards_late_turn(self):
        for harness in (True, False):
            with self.subTest(harness=harness):
                sid = f"active-{harness}"
                self.seed(sid, status="active")
                started, release = threading.Event(), threading.Event()

                def model(**kwargs):
                    if kwargs["label"] == "npc-conversation":
                        started.set()
                        release.wait(5)
                        return "我担心使用起来很麻烦。"
                    return json.dumps({"angerLevel": 1, "trustLevel": 2, "progressLevel": 1, "goalUpdates": []})

                with patch.object(settings, "harness_runtime_enabled", harness), \
                     patch("app.harness.runtime.call_model", side_effect=model), \
                     patch("app.services.conversation.call_model", side_effect=model), \
                     ThreadPoolExecutor(max_workers=1) as pool:
                    response = pool.submit(self.client.post, f"/sessions/{sid}/messages", json={"content": "有哪些顾虑？"})
                    try:
                        self.assertTrue(started.wait(5))
                        self.assertEqual(self.client.delete(f"/reviews/{sid}").status_code, 200)
                    finally:
                        release.set()
                    self.assertEqual(response.result(timeout=10).status_code, 400)
                self.assertTrue(all(count == 0 for count in self.counts(sid).values()))


if __name__ == "__main__":
    unittest.main()
