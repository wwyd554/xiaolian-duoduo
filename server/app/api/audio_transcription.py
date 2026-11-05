"""Upload a recording for local transcription; save a review only after user confirmation."""
from __future__ import annotations

import asyncio
import functools
import logging
import tempfile
import threading
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from ..auth.jwt import UserInfo, get_current_user
from ..harness.resource_limits import acquire, release, renew_asr_lease
from ..services.asr import RECORDING_FORMATS, RecordingTranscriptionError, TranscriptionCancelled, WhisperASR

router = APIRouter(prefix="/reviews", tags=["reviews"])
logger = logging.getLogger("app.asr")
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_DURATION_SECONDS = 15 * 60
SUPPORTED_EXTENSIONS = set(RECORDING_FORMATS)


def _keep_lease_alive(lease: str, finished: threading.Event) -> None:
    while not finished.wait(30):
        try:
            renew_asr_lease(lease)
        except Exception as exc:
            logger.warning("[asr] lease_renew_failed error_type=%s", type(exc).__name__)


def _run_transcription(path: Path, lease: str, language: str, cancel: threading.Event) -> dict:
    """The worker owns the temporary file and lease even if the HTTP request is cancelled."""
    finished = threading.Event()
    heartbeat = threading.Thread(target=_keep_lease_alive, args=(lease, finished), daemon=True)
    try:
        heartbeat.start()
        return WhisperASR.get().transcribe_file(
            str(path), language, cancel=cancel, max_duration=MAX_DURATION_SECONDS
        )
    finally:
        finished.set()
        if heartbeat.is_alive():
            heartbeat.join(timeout=1)
        try:
            path.unlink(missing_ok=True)
        finally:
            release(lease)


def _consume_worker_result(future: asyncio.Future) -> None:
    # A disconnected request no longer awaits this future; consume its eventual exception.
    if not future.cancelled():
        future.exception()


@router.post("/transcribe")
async def transcribe_recording(
    request: Request,
    file: UploadFile = File(...),
    language: Literal["zh", "en", "ja", "auto"] = Form("zh"),
    user: UserInfo = Depends(get_current_user),
):
    path: Path | None = None
    lease: str | None = None
    worker_owns_resources = False
    cancel = threading.Event()
    try:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            raise HTTPException(415, "请选择 MP3、WAV、M4A、AAC、OGG、FLAC 或 WebM 录音文件。")
        if file.size is not None and file.size > MAX_FILE_BYTES:
            raise HTTPException(413, "录音文件不能超过 50 MB，请压缩或分段后导入。")
        lease = acquire(user.user_id, "asr")
        with tempfile.NamedTemporaryFile(prefix="xiaolian-recording-", suffix=extension, delete=False) as destination:
            path = Path(destination.name)
            size = 0
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    raise HTTPException(413, "录音文件不能超过 50 MB，请压缩或分段后导入。")
                destination.write(chunk)
        await file.close()
        if size == 0:
            raise HTTPException(422, "录音文件为空，请重新选择。")
        future = asyncio.get_running_loop().run_in_executor(
            None, functools.partial(_run_transcription, path, lease, language, cancel)
        )
        worker_owns_resources = True
        future.add_done_callback(_consume_worker_result)
        while not future.done():
            if await request.is_disconnected():
                cancel.set()
                raise HTTPException(499, "转写已取消。")
            # asyncio.wait does not cancel the executor future if the request is cancelled.
            await asyncio.wait({future}, timeout=0.25)
        result = future.result()
        logger.info("[asr] recording_complete duration_seconds=%.1f segments=%d",
                    result["durationSeconds"], len(result["segments"]))
        return result
    except asyncio.CancelledError:
        cancel.set()
        raise
    except TranscriptionCancelled:
        raise HTTPException(499, "转写已取消。") from None
    except RecordingTranscriptionError as exc:
        raise HTTPException(exc.status_code, exc.detail) from None
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("[asr] recording_failed error_type=%s", type(exc).__name__)
        raise HTTPException(503, "本地转写暂时失败，请重试或更换录音文件。") from None
    finally:
        await file.close()
        if not worker_owns_resources:
            try:
                if path is not None:
                    path.unlink(missing_ok=True)
            finally:
                if lease is not None:
                    release(lease)
