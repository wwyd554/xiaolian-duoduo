"""TTS 路由：POST /polly/convert（沿用原 AWS API Gateway 路径，前端零改动）。

请求体：{text, voiceId?, engine?, languageCode?, textType?}
响应：{success, audioUrl(data URI), visemes, voiceId, fileName}

火山引擎 TTS 就绪后仅替换 services/tts.py 内部实现。
"""
from __future__ import annotations

import base64
import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..services import tts
from ..auth.jwt import get_current_user, UserInfo
from ..harness.resource_limits import acquire, release
from ..harness.safety import check_text

logger = logging.getLogger("app.tts")
router = APIRouter(prefix="/polly", tags=["tts"])


class PollyConvertRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voiceId: str | None = Field(default=None, max_length=100)
    engine: str | None = Field(default=None, max_length=32)
    languageCode: str | None = Field(default=None, max_length=16)
    textType: str | None = Field(default=None, pattern="^(text|ssml)$")


class PollyConvertResponse(BaseModel):
    success: bool
    audioUrl: str | None = None
    expiresIn: int | None = None
    text: str | None = None
    voiceId: str | None = None
    engine: str | None = None
    fileName: str | None = None
    visemes: list[dict] | None = None
    error: str | None = None
    message: str | None = None


@router.post("/convert", response_model=PollyConvertResponse)
async def convert(body: PollyConvertRequest, user: UserInfo = Depends(get_current_user)) -> PollyConvertResponse:
    if not body.text.strip():
        return PollyConvertResponse(success=False, error="文本为空")

    try:
        check_text(body.text, "input")
    except ValueError:
        return PollyConvertResponse(success=False, error="文本未通过安全检查")
    lease = acquire(user.user_id, "tts")
    try:
        audio, visemes = await asyncio.wait_for(tts.synthesize(
            body.text, body.voiceId, body.languageCode
        ), timeout=30)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[tts] 合成失败 error_type=%s", type(exc).__name__)
        return PollyConvertResponse(success=False, error="语音合成暂时不可用，请稍后重试")
    finally:
        release(lease)

    if not audio:
        return PollyConvertResponse(success=False, error="语音合成结果为空")

    audio_url = "data:audio/mpeg;base64," + base64.b64encode(audio).decode("ascii")
    return PollyConvertResponse(
        success=True,
        audioUrl=audio_url,
        text=body.text,
        voiceId=body.voiceId,
        engine="edge-tts",
        fileName=f"tts-{uuid.uuid4().hex[:12]}.mp3",
        visemes=visemes or None,
        expiresIn=3600,
    )
