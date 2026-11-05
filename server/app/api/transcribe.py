"""ASR WebSocket 路由：/ws/transcribe（镜像原 AWS Transcribe WebSocket 契约）。

前端 TranscribeService 契约：
- 连接：GET /ws/transcribe?session=...&token=<JWT>
- 上行：JSON {"action": "sendAudio", "audio": "<base64 PCM16/16k/mono>", "language": "zh"}
- 下行：JSON {"transcript": "...", "isPartial": true/false}

识别策略（开发期本地 whisper）：
- 后端 VAD 分段：RMS 超阈值视为说话，静音 >800ms 视为一句结束 → 输出最终结果
- 说话期间每 1.5s 输出一次中间结果（isPartial=true）
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from ..auth.jwt import decode_token
from ..services.asr import WhisperASR, pcm_rms
from ..database import independent_db
from ..config import settings
from ..harness.resource_limits import acquire, release, consume_audio

logger = logging.getLogger("app.asr")

router = APIRouter(tags=["asr"])

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
CHUNK_MS = 256  # 前端 ScriptProcessor 4096 样本 ≈ 256ms

VAD_VOICE_RMS = 0.015        # 与前端 voiceThreshold=1.5（rms*100）对齐
VAD_SILENCE_MS = 800         # 静音多久判定一句话结束
PARTIAL_INTERVAL_MS = 1500   # 中间结果输出间隔
MIN_UTTERANCE_MS = 300       # 短于此长度的语音段忽略（噪声）


@router.websocket("/ws/transcribe")
async def transcribe_ws(websocket: WebSocket, session: str = "", token: str = ""):
    # --- 鉴权（token 走查询参数，浏览器 WebSocket 无法带自定义头）---
    user_id = ""
    if token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub", "")
        except Exception:  # noqa: BLE001
            user_id = ""
    if not user_id:
        await websocket.close(code=4401)
        return

    origin = websocket.headers.get("origin")
    if origin and origin not in settings.cors_origins:
        await websocket.close(code=4403)
        return
    with independent_db() as conn:
        owned = conn.execute("SELECT status FROM sessions WHERE id=? AND user_id=?", (session, user_id)).fetchone()
    if not owned or owned["status"] != "active":
        await websocket.close(code=4403)
        return
    try:
        lease = acquire(user_id, "asr")
    except HTTPException:
        await websocket.close(code=4429)
        return

    asr = None
    language = "zh"

    utterance = bytearray()        # 当前语音段（含说话期间的全部音频）
    pre_roll = bytearray()         # 说话前的预滚缓存（保留半秒，避免吃掉字头）
    speaking = False
    silence_ms = 0.0
    last_partial_at = 0.0
    loop = asyncio.get_running_loop()

    async def _send(transcript: str, is_partial: bool) -> None:
        await websocket.send_json({"transcript": transcript, "isPartial": is_partial})

    async def _finalize() -> None:
        nonlocal utterance, pre_roll, speaking, silence_ms
        dur_ms = len(utterance) / (SAMPLE_RATE * BYTES_PER_SAMPLE) * 1000
        if dur_ms >= MIN_UTTERANCE_MS:
            pcm = bytes(utterance)
            text = await loop.run_in_executor(None, asr.transcribe_pcm16, pcm, language)
            if text:
                await _send(text, False)
                logger.info("[asr] final duration_seconds=%.1f", dur_ms / 1000)
        utterance = bytearray()
        pre_roll = bytearray()
        speaking = False
        silence_ms = 0.0

    async def _partial() -> None:
        nonlocal last_partial_at
        dur_ms = len(utterance) / (SAMPLE_RATE * BYTES_PER_SAMPLE) * 1000
        if dur_ms < MIN_UTTERANCE_MS * 2:
            return
        pcm = bytes(utterance)
        text = await loop.run_in_executor(None, asr.transcribe_pcm16, pcm, language)
        if text:
            await _send(text, True)
        last_partial_at = time.monotonic()

    try:
        await websocket.accept()
        asr = WhisperASR.get()
        started = time.monotonic()
        last_access_check = started
        while True:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=60)
            if time.monotonic() - started > 900 or time.time() >= payload["exp"]:
                await websocket.close(code=4401)
                return
            if time.monotonic() - last_access_check > 5:
                with independent_db() as conn:
                    owned = conn.execute("SELECT status FROM sessions WHERE id=? AND user_id=?", (session, user_id)).fetchone()
                if not owned or owned["status"] != "active":
                    await websocket.close(code=4403)
                    return
                last_access_check = time.monotonic()
            if len(raw) > 100000:
                await websocket.close(code=1009)
                return
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.close(code=1008)
                return
            if not isinstance(msg, dict):
                await websocket.close(code=1008)
                return
            if msg.get("action") != "sendAudio":
                continue
            if msg.get("language"):
                language = str(msg["language"])[:8]

            audio_b64 = msg.get("audio") or ""
            try:
                pcm = base64.b64decode(audio_b64, validate=True)
            except Exception:  # noqa: BLE001
                await websocket.close(code=1008)
                return
            if not pcm:
                continue
            if len(pcm) > 65536 or len(pcm) % 2:
                await websocket.close(code=1009)
                return
            consume_audio(user_id, len(pcm))

            rms = pcm_rms(pcm)
            is_voice = rms > VAD_VOICE_RMS
            now = time.monotonic()

            if is_voice:
                if not speaking:
                    # 进入说话状态：带上预滚音频，避免吃掉字头
                    utterance.extend(pre_roll)
                    pre_roll = bytearray()
                    speaking = True
                silence_ms = 0.0
                utterance.extend(pcm)
                # 说话中周期性输出中间结果
                if now - last_partial_at > PARTIAL_INTERVAL_MS / 1000:
                    await _partial()
            else:
                if speaking:
                    silence_ms += len(pcm) / (SAMPLE_RATE * BYTES_PER_SAMPLE) * 1000
                    utterance.extend(pcm)
                    if silence_ms >= VAD_SILENCE_MS:
                        await _finalize()
                else:
                    # 未说话：滚动保留约 500ms 预滚
                    pre_roll.extend(pcm)
                    keep = SAMPLE_RATE * BYTES_PER_SAMPLE // 2
                    if len(pre_roll) > keep:
                        del pre_roll[: len(pre_roll) - keep]
            if len(utterance) >= SAMPLE_RATE * BYTES_PER_SAMPLE * 20:
                await _finalize()

    except WebSocketDisconnect:
        logger.info("[asr] WebSocket 断开")
    except HTTPException:
        await websocket.close(code=4429)
    except asyncio.TimeoutError:
        await websocket.close(code=1000)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[asr] WebSocket 异常 error_type=%s", type(exc).__name__)
        await websocket.close(code=1011)
    finally:
        release(lease)
