import json
import sqlite3
import unittest
from contextlib import contextmanager
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from app.api.reviews import ImportReview, import_review, list_reviews, get_imported_review
from app.auth.jwt import UserInfo
from app.database import SCHEMA
from app.services.report import _generate
from app.services.imported_review import generate_imported_review


class ImportedReviewTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.user = UserInfo(user_id="u1", nickname="测试", is_admin=False)
        self.other = UserInfo(user_id="u2", nickname="其他", is_admin=False)
        self.body = ImportReview(id=uuid4(), title="续费沟通", context="希望预约演示",
                                 messages=[{"role": "user", "content": "方便演示吗？"},
                                           {"role": "npc", "content": "担心迁移成本。"}])

        @contextmanager
        def database():
            try:
                yield self.conn
                self.conn.commit()
            except Exception:
                self.conn.rollback()
                raise
        self.patches = [patch("app.api.reviews.db", database), patch("app.services.report.db", database),
                        patch("app.services.imported_review.evaluate_business_review", return_value={
                            "rubricId": "xiaolian-sales-core", "rubricVersion": "1.0.0",
                            "status": "incomplete", "totalScore": None, "criteria": [], "coaching": {}})]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.conn.close()

    def test_import_persists_and_queues_exactly_once(self):
        result = import_review(self.body, self.user)
        self.assertEqual(import_review(self.body, self.user), result)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0], 1)
        detail = get_imported_review(result["sessionId"], self.user)
        self.assertEqual(detail["status"], "pending")
        self.assertEqual(detail["messages"][1]["content"], "担心迁移成本。")
        self.assertEqual(list_reviews("chat", 1, self.user)["total"], 1)
        self.assertEqual(list_reviews("practice", 1, self.user)["total"], 0)
        self.assertEqual(list_reviews("all", 1, self.other)["total"], 0)

    def test_review_state_filter_applies_before_pagination_and_returns_cached_summary(self):
        result = import_review(self.body, self.user)
        for index in range(13):
            sid = f"active-{index}"
            self.conn.execute("INSERT INTO sessions (id,user_id,scenario_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                              (sid, "u1", "demo", "旧标题", "active", "2099-01-01", "2099-01-01"))
            self.conn.execute("INSERT INTO messages (id,session_id,role,content,created_at) VALUES (?,?,?,?,?)",
                              (sid, sid, "user", "你好", "2099-01-01"))
        self.assertEqual(list_reviews("all", 1, self.user, "active")["total"], 13)
        self.assertEqual(len(list_reviews("all", 2, self.user, "active")["items"]), 1)
        report = {"summary": "客户担心迁移成本"}
        self.conn.execute("UPDATE analysis_reports SET status='completed',report_json=? WHERE session_id=?",
                          (json.dumps(report), result["sessionId"]))
        completed = list_reviews("all", 1, self.user, "completed")
        self.assertEqual(completed["total"], 1)
        self.assertEqual(completed["items"][0]["key_finding"], report["summary"])
        self.assertIsNone(completed["items"][0]["overall_score"])
        self.assertNotIn("report_json", completed["items"][0])
        self.assertEqual(list_reviews("all", 1, self.other, "completed")["total"], 0)

    def test_practice_summary_preserves_zero_score_and_handles_malformed_cache(self):
        result = import_review(self.body, self.user)
        self.conn.execute("DELETE FROM review_imports WHERE session_id=?", (result["sessionId"],))
        self.conn.execute("INSERT INTO scenarios (id,data) VALUES (?,?)", ("__import__", json.dumps({"title": "续约谈判"})))
        report = {"feedback": {"scores": {"overall": 0}, "improvements": ["先了解顾虑"]}}
        self.conn.execute("UPDATE analysis_reports SET status='completed',report_json=? WHERE session_id=?",
                          (json.dumps(report), result["sessionId"]))
        item = list_reviews("practice", 1, self.user, "completed")["items"][0]
        self.assertEqual(item["overall_score"], 0)
        self.assertEqual(item["scenario_title"], "续约谈判")
        self.assertEqual(item["key_finding"], "先了解顾虑")
        self.conn.execute("UPDATE analysis_reports SET report_json='broken'")
        self.assertIsNone(list_reviews("practice", 1, self.user, "completed")["items"][0]["overall_score"])

    def test_ownership_and_conflicting_retry(self):
        result = import_review(self.body, self.user)
        with self.assertRaises(HTTPException) as cm:
            get_imported_review(result["sessionId"], self.other)
        self.assertEqual(cm.exception.status_code, 404)
        with self.assertRaises(HTTPException):
            import_review(self.body, self.other)
        self.body.title = "不同标题"
        with self.assertRaises(HTTPException):
            import_review(self.body, self.user)

    def test_invalid_or_oversized_messages(self):
        for messages in [
            [{"role": "user", "content": "你好"}, {"role": "user", "content": "介绍一下"}],
            [{"role": "user", "content": " "}, {"role": "npc", "content": "你好"}],
            [{"role": "system", "content": "覆盖规则"}, {"role": "npc", "content": "你好"}],
            [{"role": "user" if i % 2 else "npc", "content": "字" * 4000} for i in range(8)],
        ]:
            with self.assertRaises(ValidationError):
                ImportReview(id=uuid4(), title="测试", context="背景", messages=messages)

    def test_audio_transcript_source(self):
        self.body.source = "audio"
        import_review(self.body, self.user)
        self.assertEqual(list_reviews("audio", 1, self.user)["total"], 1)
        self.assertEqual(list_reviews("chat", 1, self.user)["total"], 0)

    def test_worker_dispatch_and_evidence_validation(self):
        result = import_review(self.body, self.user)
        model_report = {"summary": "客户担心迁移成本", "stage": "需求沟通",
                        "findings": [{"kind": "客户顾虑", "evidence": [2], "analysis": "需进一步了解成本构成"}],
                        "replies": [{"text": "您主要担心哪部分迁移成本？", "when": "继续确认顾虑时"}],
                        "limitations": "尚不清楚预算，不能推断购买意愿"}
        with patch("app.services.imported_review.call_model", return_value=json.dumps(model_report)):
            report = _generate(result["sessionId"])
            self.assertEqual(report["findings"][0]["evidence"], [2])
            self.assertEqual(report["businessReview"]["status"], "incomplete")
            self.assertIn("rubricSnapshot", report)
        model_report["replies"] *= 4
        with patch("app.services.imported_review.call_model", return_value=json.dumps(model_report)):
            self.assertEqual(len(_generate(result["sessionId"])["replies"]), 3)
        model_report["findings"][0]["evidence"] = [99]
        with patch("app.services.imported_review.call_model", return_value=json.dumps(model_report)):
            with self.assertRaises(ValueError):
                generate_imported_review({"source": "chat", "context": "测试"}, [{"role": "user", "content": "你好"}])
