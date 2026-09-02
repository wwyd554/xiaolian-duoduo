from __future__ import annotations

import json
import sqlite3
import unittest
from contextlib import contextmanager
from unittest.mock import patch

from app.api.analysis import retry_analysis
from app.api.sessions import complete_session, list_sessions
from app.auth.jwt import UserInfo
from app.database import SCHEMA


class SessionApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.user = UserInfo(user_id="user-1", nickname="测试用户", is_admin=False)
        self.conn.execute(
            "INSERT INTO scenarios (id, data) VALUES (?, ?)",
            ("scenario-1", json.dumps({"title": "需求挖掘练习"})),
        )
        self.conn.executemany(
            "INSERT INTO sessions "
            "(id, user_id, scenario_id, title, status, npc_info, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    "session-new",
                    "user-1",
                    "scenario-1",
                    "最近练习",
                    "completed",
                    json.dumps({"name": "林一凡", "role": "销售总监", "company": "星辰科技"}),
                    "2026-08-31T10:00:00+00:00",
                    "2026-08-31T10:05:00+00:00",
                ),
                (
                    "session-old",
                    "user-1",
                    "scenario-1",
                    "较早练习",
                    "active",
                    None,
                    "2026-08-30T10:00:00+00:00",
                    "2026-08-30T10:01:00+00:00",
                ),
                (
                    "session-other-user",
                    "user-2",
                    "scenario-1",
                    "其他用户练习",
                    "completed",
                    None,
                    "2026-08-31T11:00:00+00:00",
                    "2026-08-31T11:02:00+00:00",
                ),
                (
                    "session-empty",
                    "user-1",
                    "scenario-1",
                    "误创建的空会话",
                    "active",
                    None,
                    "2026-08-29T10:00:00+00:00",
                    "2026-08-29T10:00:00+00:00",
                ),
            ],
        )
        self.conn.executemany(
            "INSERT INTO messages "
            "(id, session_id, role, content, metrics, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [
                ("m1", "session-new", "user", "您好", None, "2026-08-31T10:01:00+00:00"),
                (
                    "m2",
                    "session-new",
                    "npc",
                    "您好，请讲",
                    json.dumps({"angerLevel": 1, "trustLevel": 6, "progressLevel": 4}),
                    "2026-08-31T10:01:01+00:00",
                ),
                (
                    "m3",
                    "session-old",
                    "user",
                    "我想继续上次的练习",
                    None,
                    "2026-08-30T10:00:30+00:00",
                ),
            ],
        )
        self.conn.execute(
            "INSERT INTO analysis_reports "
            "(session_id, status, report_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (
                "session-new",
                "completed",
                json.dumps(
                    {
                        "feedback": {
                            "scores": {
                                "overall": 82,
                                "communication": 80,
                                "trustBuilding": 84,
                            }
                        }
                    }
                ),
                "2026-08-31T10:05:00+00:00",
                "2026-08-31T10:05:00+00:00",
            ),
        )
        self.conn.commit()

        @contextmanager
        def test_db():
            try:
                yield self.conn
                self.conn.commit()
            except Exception:
                self.conn.rollback()
                raise

        self.db_patcher = patch("app.api.sessions.db", test_db)
        self.db_patcher.start()
        self.analysis_db_patcher = patch("app.api.analysis.db", test_db)
        self.analysis_db_patcher.start()

    def tearDown(self) -> None:
        self.analysis_db_patcher.stop()
        self.db_patcher.stop()
        self.conn.close()

    def test_list_sessions_returns_review_summary_and_pagination(self) -> None:
        first_page = list_sessions(
            limit=1,
            nextToken=None,
            scenarioId=None,
            user=self.user,
        )

        self.assertEqual(first_page["totalCount"], 2)
        self.assertEqual(first_page["nextToken"], "1")
        self.assertEqual(len(first_page["sessions"]), 1)

        session = first_page["sessions"][0]
        self.assertEqual(session["sessionId"], "session-new")
        self.assertEqual(session["scenarioName"], "需求挖掘练习")
        self.assertEqual(session["messageCount"], 2)
        self.assertEqual(session["duration"], 300)
        self.assertEqual(session["metrics"]["trustLevel"], 6)
        self.assertEqual(session["scores"]["overall"], 82)

        second_page = list_sessions(
            limit=1,
            nextToken=first_page["nextToken"],
            scenarioId=None,
            user=self.user,
        )
        self.assertEqual(second_page["sessions"][0]["sessionId"], "session-old")
        self.assertIsNone(second_page["nextToken"])
        self.assertNotIn(
            "session-empty",
            {item["sessionId"] for item in first_page["sessions"] + second_page["sessions"]},
        )

    @patch("app.api.sessions.report.trigger_async")
    def test_complete_session_persists_status_and_starts_review(self, trigger_async) -> None:
        response = complete_session("session-old", user=self.user)

        stored = self.conn.execute(
            "SELECT status FROM sessions WHERE id = 'session-old'"
        ).fetchone()
        self.assertEqual(stored["status"], "completed")
        self.assertEqual(response.status, "completed")
        trigger_async.assert_called_once_with("session-old")

    @patch("app.api.analysis.report.trigger_async")
    def test_retry_analysis_checks_owner_and_restarts_report(self, trigger_async) -> None:
        response = retry_analysis("session-new", user=self.user)

        self.assertEqual(response["status"], "processing")
        trigger_async.assert_called_once_with("session-new")


if __name__ == "__main__":
    unittest.main()
