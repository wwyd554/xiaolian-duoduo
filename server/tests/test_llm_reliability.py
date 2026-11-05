import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
from anthropic import APIStatusError, APITimeoutError
from app.agents.llm import call_model
from app.config import settings
from app.harness.observability import trace_id


class ModelReliabilityTests(unittest.TestCase):
    def run_model(self, outcomes):
        client = MagicMock()
        client.messages.create.side_effect = outcomes
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(settings, "trace_dir", Path(directory)), \
             patch.object(settings, "llm_max_retries", 3), \
             patch("app.agents.llm.get_client", return_value=client), \
             patch("app.agents.llm.time.sleep") as sleep:
            token = trace_id.set("model-test")
            try:
                try:
                    result = call_model(system="private-system", messages=[{"role": "user", "content": "private-input"}], model="test-model")
                except Exception as exc:
                    result = exc
            finally:
                trace_id.reset(token)
            records = [json.loads(line) for path in Path(directory).glob("events-*.jsonl") for line in path.read_text().splitlines()]
        self.assertNotIn("private-", json.dumps(records))
        self.assertTrue(all(r["trace_id"] == "model-test" for r in records))
        return result, client.messages.create.call_count, sleep.call_count, records

    def response(self, text="valid", stop="end_turn"):
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)], stop_reason=stop,
                               usage=SimpleNamespace(input_tokens=20, output_tokens=5))

    def api_error(self, status):
        return APIStatusError("private-provider-error", response=httpx.Response(status, request=httpx.Request("POST", "https://example.invalid")), body=None)

    def test_transient_error_retries_once_then_records_usage(self):
        result, count, sleeps, records = self.run_model([self.api_error(429), self.response()])
        self.assertEqual((result, count, sleeps), ("valid", 2, 1))
        self.assertEqual(records[-1]["input_tokens"], 20)

    def test_authentication_error_does_not_retry_or_leak(self):
        result, count, sleeps, _ = self.run_model([self.api_error(401)])
        self.assertIsInstance(result, RuntimeError)
        self.assertNotIn("private", str(result))
        self.assertEqual((count, sleeps), (1, 0))

    def test_timeout_has_bounded_attempts(self):
        error = APITimeoutError(request=httpx.Request("POST", "https://example.invalid"))
        result, count, sleeps, _ = self.run_model([error, error, error])
        self.assertIsInstance(result, RuntimeError)
        self.assertEqual((count, sleeps), (3, 2))

    def thinking_request(self, label, review="disabled", realtime="enabled"):
        client = MagicMock()
        client.messages.create.return_value = self.response("{}")
        with patch("app.agents.llm.get_client", return_value=client), \
             patch("app.agents.llm.record_trajectory"), \
             patch.object(settings, "llm_review_thinking", review), \
             patch.object(settings, "llm_realtime_thinking", realtime):
            call_model(system="test", messages=[{"role": "user", "content": "test"}],
                       model="test-model", max_tokens=8192, label=label)
        kwargs = client.messages.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "test-model")
        self.assertEqual(kwargs["max_tokens"], 8192)
        return kwargs

    def test_reviews_use_independent_explicit_thinking_setting(self):
        for label in ("business-review", "imported-review"):
            with self.subTest(label=label):
                kwargs = self.thinking_request(label)
                self.assertEqual(kwargs["extra_body"], {"thinking": {"type": "disabled"}})
                kwargs = self.thinking_request(label, review="enabled", realtime="disabled")
                self.assertEqual(kwargs["extra_body"], {"thinking": {"type": "enabled"}})
                self.assertNotIn("extra_body", self.thinking_request(label, review="inherit"))

    def test_review_setting_does_not_change_realtime_or_other_calls(self):
        for label in ("npc-conversation", "realtime-scoring", "goal-completion"):
            with self.subTest(label=label):
                kwargs = self.thinking_request(label, review="disabled", realtime="enabled")
                self.assertEqual(kwargs["extra_body"], {"thinking": {"type": "enabled"}})
                self.assertNotIn("extra_body", self.thinking_request(label, review="disabled", realtime="inherit"))
        self.assertNotIn("extra_body", self.thinking_request("scenario-generation"))

    def test_empty_or_truncated_output_is_not_success(self):
        for response in (self.response(""), self.response("partial", "max_tokens")):
            result, count, _, records = self.run_model([response])
            self.assertIsInstance(result, ValueError)
            self.assertEqual(count, 1)
            self.assertEqual(records[-1]["status"], "invalid_output")
