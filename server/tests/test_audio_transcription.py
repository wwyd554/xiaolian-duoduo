import asyncio
import io
import math
import tempfile
import threading
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile
from app.main import app
from app.auth.jwt import UserInfo, get_current_user
from app.api.audio_transcription import transcribe_recording
from app.services.asr import WhisperASR, RecordingTranscriptionError, TranscriptionCancelled, decode_recording


def wav_bytes(seconds=0.25):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        samples = (np.sin(np.arange(int(seconds * 16000)) * 2 * math.pi * 440 / 16000) * 4000).astype("<i2")
        wav.writeframes(samples.tobytes())
    return buffer.getvalue()


RESULT = {"text": "你好\n价格是多少", "segments": [{"start": 0, "end": 1, "text": "你好"},
          {"start": 1, "end": 2, "text": "价格是多少"}], "durationSeconds": 2, "language": "zh"}


class RecordingEndpointTests(unittest.TestCase):
    def setUp(self):
        from app.config import settings
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        patch.object(settings, "trace_dir", Path(directory.name) / "traces").start()
        self.client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)
        app.dependency_overrides[get_current_user] = lambda: UserInfo(user_id="test-u", nickname="测试", is_admin=False)
        self.addCleanup(app.dependency_overrides.clear)
        self.acquire = patch("app.api.audio_transcription.acquire", return_value="lease").start()
        self.release = patch("app.api.audio_transcription.release").start()
        self.asr = MagicMock()
        patch("app.api.audio_transcription.WhisperASR.get", return_value=self.asr).start()
        self.addCleanup(patch.stopall)

    def post(self, name="call.wav", content=None):
        return self.client.post("/reviews/transcribe", files={"file": (name, wav_bytes() if content is None else content, "audio/wav")}, data={"language": "zh"})

    def test_requires_authentication(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.post().status_code, 401)
        self.acquire.assert_not_called()

    def test_success_returns_unassigned_segments_and_removes_temporary_file(self):
        seen = []
        def recognize(path, language, **kwargs):
            self.assertTrue(Path(path).is_file())
            seen.append(Path(path))
            self.assertEqual(language, "zh")
            self.assertEqual(kwargs["max_duration"], 900)
            return RESULT
        self.asr.transcribe_file.side_effect = recognize
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), RESULT)
        self.assertNotIn("role", response.json()["segments"][0])
        self.assertFalse(seen[0].exists())
        self.release.assert_called_once_with("lease")

    def test_rejects_unsupported_empty_oversize_and_invalid_language(self):
        self.assertEqual(self.post("file.txt").status_code, 415)
        self.assertEqual(self.post(content=b"").status_code, 422)
        with patch("app.api.audio_transcription.MAX_FILE_BYTES", 8):
            self.assertEqual(self.post().status_code, 413)
        response = self.client.post("/reviews/transcribe", files={"file": ("call.wav", wav_bytes())}, data={"language": "invalid"})
        self.assertEqual(response.status_code, 422)
        self.asr.transcribe_file.assert_not_called()

    def test_errors_are_sanitized_and_worker_cleans_up(self):
        seen = []
        def fail(path, *args, **kwargs):
            seen.append(Path(path))
            raise RuntimeError("secret-user-path")
        self.asr.transcribe_file.side_effect = fail
        response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret-user-path", response.text)
        self.assertFalse(seen[0].exists())
        self.release.assert_called_once_with("lease")

    def test_busy_limit_stops_before_transcription(self):
        from fastapi import HTTPException
        self.acquire.side_effect = HTTPException(429, "语音资源繁忙")
        self.assertEqual(self.post().status_code, 429)
        self.asr.transcribe_file.assert_not_called()
        self.release.assert_not_called()


class RecordingServiceTests(unittest.TestCase):
    def test_decodes_real_wave_and_bounds_duration(self):
        with tempfile.NamedTemporaryFile(suffix=".wav") as file:
            file.write(wav_bytes())
            file.flush()
            audio = decode_recording(file.name, threading.Event(), 900)
            self.assertEqual(audio.dtype, np.float32)
            self.assertEqual(len(audio), 4000)
            with self.assertRaises(RecordingTranscriptionError) as caught:
                decode_recording(file.name, threading.Event(), 0.1)
            self.assertEqual(caught.exception.status_code, 422)

    def test_invalid_audio_is_rejected(self):
        with tempfile.NamedTemporaryFile(suffix=".wav") as file:
            file.write(b"not really audio")
            file.flush()
            with self.assertRaises(RecordingTranscriptionError):
                decode_recording(file.name, threading.Event(), 900)

    def test_duration_bound_works_without_duration_metadata(self):
        import av
        frame = av.AudioFrame.from_ndarray(np.ones((1, 1600), dtype=np.int16), format="s16", layout="mono")
        frame.sample_rate = 16000
        container = MagicMock()
        container.duration = None
        container.streams.audio = [object()]
        container.decode.return_value = iter([frame])
        container.__enter__.return_value = container
        with patch("av.open", return_value=container), self.assertRaises(RecordingTranscriptionError):
            decode_recording("unused.wav", threading.Event(), 0.05)

    def test_uses_local_model_and_preserves_all_text_when_coalescing_segments(self):
        asr = WhisperASR()
        model = MagicMock()
        source = [SimpleNamespace(start=i, end=i+1, text=f"片段{i}") for i in range(201)]
        model.transcribe.return_value = (iter(source), SimpleNamespace(language="zh"))
        with patch("app.services.asr.decode_recording", return_value=np.ones(16000, dtype=np.float32)), patch.object(asr, "_ensure_model", return_value=model) as ensure:
            result = asr.transcribe_file("unused")
        ensure.assert_called_once_with(local_files_only=True)
        self.assertLessEqual(len(result["segments"]), 200)
        for index in range(201):
            self.assertIn(f"片段{index}", result["text"])
        self.assertEqual(result["segments"][-1]["end"], 201)

    def test_no_text_and_overlong_text_are_not_truncated(self):
        for items in ([], [SimpleNamespace(start=0, end=1, text="字" * 30001)]):
            asr = WhisperASR()
            model = MagicMock()
            model.transcribe.return_value = (iter(items), SimpleNamespace(language="zh"))
            with patch("app.services.asr.decode_recording", return_value=np.ones(16000, dtype=np.float32)), patch.object(asr, "_ensure_model", return_value=model), self.assertRaises(RecordingTranscriptionError):
                asr.transcribe_file("unused")

    def test_cancellation_stops_before_model_load(self):
        event = threading.Event()
        event.set()
        asr = WhisperASR()
        with patch("app.services.asr.decode_recording", return_value=np.ones(16000, dtype=np.float32)), patch.object(asr, "_ensure_model") as ensure, self.assertRaises(TranscriptionCancelled):
            asr.transcribe_file("unused", cancel=event)
        ensure.assert_not_called()


    def test_renewed_recording_lease_prevents_premature_reuse(self):
        from fastapi import HTTPException
        from app.config import settings
        from app.database import SCHEMA, independent_db
        from app.harness.resource_limits import acquire, release, renew_asr_lease
        with tempfile.TemporaryDirectory() as directory, patch.object(settings, "database_path", Path(directory) / "test.db"):
            with independent_db() as conn:
                conn.executescript(SCHEMA)
            lease = acquire("recording-user", "asr")
            with independent_db() as conn:
                conn.execute("UPDATE resource_leases SET expires_at=0 WHERE id=?", (lease,))
            renew_asr_lease(lease)
            with self.assertRaises(HTTPException) as caught:
                acquire("recording-user", "asr")
            self.assertEqual(caught.exception.status_code, 429)
            release(lease)
            next_lease = acquire("recording-user", "asr")
            release(next_lease)


class RecordingCancellationTests(unittest.IsolatedAsyncioTestCase):
    async def test_cancelled_request_keeps_file_and_lease_until_worker_exits(self):
        started, allow_exit, released = threading.Event(), threading.Event(), threading.Event()
        seen = []
        def recognize(path, language, **kwargs):
            seen.append((Path(path), kwargs["cancel"]))
            started.set()
            if not allow_exit.wait(3):
                raise RuntimeError("test worker timed out")
            if kwargs["cancel"].is_set():
                raise TranscriptionCancelled()
            return RESULT
        asr = MagicMock()
        asr.transcribe_file.side_effect = recognize
        request = SimpleNamespace(is_disconnected=AsyncMock(return_value=False))
        file = UploadFile(filename="call.wav", file=io.BytesIO(wav_bytes()))
        with patch("app.api.audio_transcription.acquire", return_value="lease"), patch("app.api.audio_transcription.release", side_effect=lambda _: released.set()) as release, patch("app.api.audio_transcription.WhisperASR.get", return_value=asr):
            task = asyncio.create_task(transcribe_recording(request, file, "zh", UserInfo(user_id="u", nickname="测试", is_admin=False)))
            try:
                self.assertTrue(await asyncio.to_thread(started.wait, 2))
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
                self.assertTrue(seen[0][1].is_set())
                self.assertTrue(seen[0][0].exists())
                release.assert_not_called()
            finally:
                allow_exit.set()
                self.assertTrue(await asyncio.to_thread(released.wait, 2))
                await asyncio.sleep(0)
            self.assertFalse(seen[0][0].exists())
            release.assert_called_once_with("lease")


if __name__ == "__main__":
    unittest.main()
