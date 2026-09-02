from __future__ import annotations

import sqlite3
import unittest
from unittest.mock import patch

from app.agents.prompts import build_npc_system_prompt, build_scoring_prompt
from app.services.conversation import (
    HISTORY_LIMIT,
    _build_llm_history,
    _run_npc_turn,
    _run_scoring,
)


class ConversationContextTests(unittest.TestCase):
    def test_history_uses_latest_messages_in_chronological_order(self) -> None:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute(
            "CREATE TABLE messages ("
            "id TEXT, session_id TEXT, role TEXT, content TEXT, created_at TEXT)"
        )
        for index in range(HISTORY_LIMIT + 2):
            conn.execute(
                "INSERT INTO messages VALUES (?, 'session-1', ?, ?, ?)",
                (
                    str(index),
                    "user" if index % 2 == 0 else "npc",
                    f"message-{index}",
                    f"2026-08-30T09:00:{index:02d}+00:00",
                ),
            )

        history = _build_llm_history(conn, "session-1")

        self.assertEqual(len(history), HISTORY_LIMIT)
        self.assertEqual(history[0]["content"], "message-2")
        self.assertEqual(history[-1]["content"], "message-11")
        self.assertEqual(history[1]["sender"], "npc")

    @patch("app.services.conversation.call_model", return_value="客户回复")
    def test_npc_history_preserves_user_and_assistant_roles(self, call_model_mock) -> None:
        history = [
            {"sender": "user", "content": "销售发言"},
            {"sender": "npc", "content": "客户回应"},
        ]

        result = _run_npc_turn("system", history, "最新销售发言")

        self.assertEqual(result, "客户回复")
        self.assertEqual(
            call_model_mock.call_args.kwargs["messages"],
            [
                {"role": "user", "content": "销售发言"},
                {"role": "assistant", "content": "客户回应"},
                {"role": "user", "content": "最新销售发言"},
            ],
        )

    @patch("app.services.conversation.call_model", return_value="{ incomplete json")
    def test_scoring_failure_preserves_current_scores(self, call_model_mock) -> None:
        result = _run_scoring(
            "听得到吗？",
            [],
            {"angerLevel": 2, "trustLevel": 5, "progressLevel": 3},
            [],
            "基金定投陪练",
            "zh",
        )

        self.assertEqual(
            result["scores"],
            {"angerLevel": 2, "trustLevel": 5, "progressLevel": 3},
        )
        self.assertEqual(call_model_mock.call_args.kwargs["max_tokens"], 2048)

    def test_prompts_treat_transcription_noise_as_clarification(self) -> None:
        npc_prompt = build_npc_system_prompt(
            {"name": "林一凡", "role": "公司职员", "company": "IT 公司"},
            {"angerLevel": 1, "trustLevel": 5, "progressLevel": 3},
            scenario_description="基金定投陪练",
            initial_message="每个月只能拿出几百块，够吗？",
        )
        scoring_prompt = build_scoring_prompt(
            user_message="听得到吗？完全不够",
            previous_messages=[],
            current_scores={"angerLevel": 1, "trustLevel": 5, "progressLevel": 3},
            goals=[],
        )

        self.assertIn("你只扮演客户，不是销售人员", npc_prompt)
        self.assertIn("只提出一个具体的澄清问题", npc_prompt)
        self.assertIn("每个月只能拿出几百块，够吗？", npc_prompt)
        self.assertIn("原则上保持三个分数不变", scoring_prompt)


if __name__ == "__main__":
    unittest.main()
