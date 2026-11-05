import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.config import Settings, settings
from app.harness.observability import emit, trace_id
from app.services.report import _parse_report_json
from app.main import lifespan, app


class ReliabilityTests(unittest.TestCase):
    def test_telemetry_does_not_serialize_prompts_or_raw_errors(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(settings, "trace_dir", Path(directory)):
            token = trace_id.set("test-trace")
            try:
                emit("model_call", label="npc", input_tokens=12, system_preview="secret",
                     output_preview="private", error="key=secret", user_message="private")
            finally:
                trace_id.reset(token)
            data = json.loads(next(Path(directory).glob("events-*.jsonl")).read_text())
            self.assertEqual(data["trace_id"], "test-trace")
            self.assertEqual(data["input_tokens"], 12)
            self.assertNotIn("private", json.dumps(data))
            self.assertNotIn("secret", json.dumps(data))

    def test_production_rejects_unsafe_configuration(self):
        config = Settings()
        config.environment = "production"
        config.jwt_secret = "change-me-to-a-long-random-secret"
        with self.assertRaises(ValueError):
            config.validate()
        config.jwt_secret = "x" * 40
        config.auth_dev_bypass = True
        with self.assertRaises(ValueError):
            config.validate()
        config.auth_dev_bypass = False
        config.cors_origins = ["*"]
        with self.assertRaises(ValueError):
            config.validate()
        config.cors_origins = ["https://sales.example.com"]
        config.deepseek_api_key = "test-key"
        config.llm_chat_model = config.llm_reasoner_model = "test-model"
        config.validate()

    def test_review_thinking_mode_is_validated(self):
        config = Settings()
        config.environment = "test"
        for mode in ("disabled", "enabled", "inherit"):
            config.llm_review_thinking = mode
            config.validate()
        config.llm_review_thinking = "unbounded"
        with self.assertRaisesRegex(ValueError, "LLM_REVIEW_THINKING"):
            config.validate()

    def test_invalid_report_does_not_become_default_scores(self):
        for raw in ('{}', '{"scores":{"overall":60}}', 'not json'):
            with self.assertRaises(ValueError):
                _parse_report_json(raw)

    def test_invalid_time_limits_are_rejected(self):
        for field, value in (("job_poll_seconds", float("nan")), ("job_lease_seconds", float("inf")),
                             ("llm_timeout_seconds", 0), ("job_max_attempts", 0)):
            config = Settings()
            config.environment = "test"
            setattr(config, field, value)
            with self.assertRaises(ValueError):
                config.validate()


class StartupTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_config_prevents_db_and_worker_start(self):
        with patch.object(settings, "validate", side_effect=ValueError("unsafe config")), \
             patch("app.main.init_db") as init_db, patch("app.main.ReviewWorker") as worker:
            with self.assertRaises(ValueError):
                async with lifespan(app):
                    self.fail("invalid application started")
            init_db.assert_not_called()
            worker.assert_not_called()

    async def test_valid_lifespan_starts_and_stops_worker(self):
        with patch.object(settings, "validate"), patch.object(settings, "job_worker_enabled", True), \
             patch("app.main.init_db"), patch("app.main.seed_scenarios"), patch("app.main.ReviewWorker") as worker:
            async with lifespan(app):
                worker.return_value.start.assert_called_once()
            worker.return_value.stop.assert_called_once()
