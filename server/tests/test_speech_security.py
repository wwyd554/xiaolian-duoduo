import base64
import json
import logging
import struct
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
import jwt

from app.main import app
from app.auth.jwt import create_token, get_current_user, decode_token
from app.config import settings
from app.database import SCHEMA, independent_db
from app.harness.resource_limits import acquire, release, consume_audio
from app.harness.logging_filters import WebSocketTokenFilter


class SpeechSecurityTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        directory = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.stack.enter_context(patch.object(settings, "database_path", Path(directory) / "test.db"))
        self.stack.enter_context(patch.object(settings, "trace_dir", Path(directory) / "traces"))
        self.stack.enter_context(patch.object(settings, "speech_requests_per_minute", 30))
        app.dependency_overrides.clear()
        with independent_db() as conn:
            conn.executescript(SCHEMA)
            conn.execute("INSERT INTO sessions VALUES ('s','u','scene','测试','active',NULL,'t','t')")
        self.client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)
        self.token = create_token("u", "测试", False)
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.asr = MagicMock()
        self.asr.transcribe_pcm16.return_value = "你好"
        self.stack.enter_context(patch("app.api.transcribe.WhisperASR.get", return_value=self.asr))

    def url(self, token=None, session="s"):
        return f"/ws/transcribe?session={session}&token={self.token if token is None else token}"

    def refused(self, url, code, **kwargs):
        with self.assertRaises(WebSocketDisconnect) as caught:
            with self.client.websocket_connect(url, **kwargs):
                pass
        self.assertEqual(caught.exception.code, code)

    def test_tts_requires_auth_and_bounds_text_before_synthesis(self):
        with patch("app.api.tts.tts.synthesize", new_callable=AsyncMock) as synth:
            self.assertEqual(self.client.post("/polly/convert", json={"text": "你好"}).status_code, 401)
            self.assertEqual(self.client.post("/polly/convert", json={"text": "字" * 2001}, headers=self.headers).status_code, 422)
            synth.assert_not_awaited()

    def test_tts_success_keeps_contract_and_releases_lease(self):
        with patch("app.api.tts.tts.synthesize", new_callable=AsyncMock, return_value=(b"audio", [])):
            result = self.client.post("/polly/convert", json={"text": "你好"}, headers=self.headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["audioUrl"], "data:audio/mpeg;base64,YXVkaW8=")
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM resource_leases").fetchone()[0], 0)

    def test_tts_rate_limit_applies_across_requests(self):
        with patch.object(settings, "speech_requests_per_minute", 1), \
             patch("app.api.tts.tts.synthesize", new_callable=AsyncMock, return_value=(b"audio", [])) as synth:
            self.assertEqual(self.client.post("/polly/convert", json={"text": "你好"}, headers=self.headers).status_code, 200)
            result = self.client.post("/polly/convert", json={"text": "你好"}, headers=self.headers)
            self.assertEqual(result.status_code, 429)
            self.assertEqual(synth.await_count, 1)

    def test_tts_failure_is_sanitized_and_lease_released(self):
        with patch("app.api.tts.tts.synthesize", new_callable=AsyncMock, side_effect=RuntimeError("secret-path")):
            result = self.client.post("/polly/convert", json={"text": "你好"}, headers=self.headers)
        self.assertFalse(result.json()["success"])
        self.assertNotIn("secret-path", result.text)
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM resource_leases").fetchone()[0], 0)

    def test_websocket_auth_owner_status_origin(self):
        self.refused(self.url(token=""), 4401)
        self.refused(self.url(token=create_token("other", "另一个", False)), 4403)
        self.refused(self.url(session="missing"), 4403)
        self.refused(self.url(), 4403, headers={"origin": "https://evil.invalid"})
        with independent_db() as conn:
            conn.execute("UPDATE sessions SET status='completed' WHERE id='s'")
        self.refused(self.url(), 4403)
        self.asr.transcribe_pcm16.assert_not_called()

    def test_jwt_requires_expiry_and_nonempty_subject(self):
        for payload in ({"sub": "u"}, {"sub": "", "exp": 9999999999}, {"sub": "u", "exp": 1}):
            token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
            self.refused(self.url(token=token), 4401)
            with self.assertRaises(HTTPException):
                decode_token(token)

    def test_websocket_per_user_concurrency_releases_after_disconnect(self):
        with self.client.websocket_connect(self.url()):
            self.refused(self.url(), 4429)
        with self.client.websocket_connect(self.url()):
            pass
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM resource_leases").fetchone()[0], 0)

    def test_malformed_odd_and_oversized_pcm_are_closed(self):
        for payload, expected in (([], 1008), ({"action": "sendAudio", "audio": "%%%"}, 1008),
                                  ({"action": "sendAudio", "audio": base64.b64encode(b"x").decode()}, 1009),
                                  ({"action": "sendAudio", "audio": base64.b64encode(b"x" * 65538).decode()}, 1009)):
            with self.client.websocket_connect(self.url()) as ws:
                ws.send_json(payload)
                self.assertEqual(ws.receive()["code"], expected)
        self.asr.transcribe_pcm16.assert_not_called()

    def test_valid_audio_produces_transcript_without_real_whisper(self):
        voiced = struct.pack("<h", 2000) * 16000
        with self.client.websocket_connect(self.url()) as ws:
            ws.send_json({"action": "sendAudio", "audio": base64.b64encode(voiced).decode()})
            self.assertEqual(ws.receive_json(), {"transcript": "你好", "isPartial": True})
            ws.send_json({"action": "sendAudio", "audio": base64.b64encode(bytes(32000)).decode()})
            self.assertEqual(ws.receive_json(), {"transcript": "你好", "isPartial": False})
        self.assertEqual(self.asr.transcribe_pcm16.call_count, 2)

    def test_shared_audio_quota_is_not_reset_by_reconnection(self):
        consume_audio("u", 16000 * 2 * 75)
        with self.assertRaises(HTTPException) as caught:
            consume_audio("u", 2)
        self.assertEqual(caught.exception.status_code, 429)
        consume_audio("other", 2)

    def test_global_concurrency_atomic_across_connections(self):
        def take(i):
            try:
                return acquire(f"user{i}", "tts")
            except HTTPException:
                return None
        with patch.object(settings, "speech_concurrency", 2), ThreadPoolExecutor(max_workers=8) as pool:
            leases = list(pool.map(take, range(8)))
        self.assertEqual(len([lease for lease in leases if lease]), 2)
        for lease in leases:
            if lease:
                release(lease)

    def test_expired_lease_is_reclaimed(self):
        lease = acquire("u", "asr")
        with independent_db() as conn:
            conn.execute("UPDATE resource_leases SET expires_at=0 WHERE id=?", (lease,))
        new_lease = acquire("u", "asr")
        self.assertNotEqual(lease, new_lease)
        release(new_lease)

    def test_uvicorn_websocket_query_token_is_redacted(self):
        record = logging.LogRecord("uvicorn.error", logging.INFO, "", 0,
                                   'WebSocket %s [accepted]', (self.url(),), None)
        WebSocketTokenFilter().filter(record)
        self.assertNotIn(self.token, record.getMessage())
        self.assertIn("token=[REDACTED]", record.getMessage())
