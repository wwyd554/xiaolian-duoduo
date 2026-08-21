"""ASR 服务（阶段 3）：faster-whisper 本地识别（开发期）。

- 模型懒加载（首次使用才下载/加载），CPU int8 量化
- 输入约定：PCM16 / 16kHz / 单声道（与前端 TranscribeService 采集参数一致）
- 后续切换火山引擎流式 ASR 时替换本模块，WebSocket 路由契约不变
"""
from __future__ import annotations

import logging
import threading

import numpy as np

from ..config import settings

logger = logging.getLogger("app.asr")


class WhisperASR:
    """faster-whisper 单例封装（模型加载有秒级开销，进程内只加载一次）。"""

    _instance: "WhisperASR | None" = None
    _instance_lock = threading.Lock()

    def __init__(self) -> None:
        self._model = None
        self._model_lock = threading.Lock()

    @classmethod
    def get(cls) -> "WhisperASR":
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _ensure_model(self):
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    from faster_whisper import WhisperModel

                    logger.info("[asr] 加载 whisper 模型: %s (cpu/int8)", settings.whisper_model)
                    self._model = WhisperModel(
                        settings.whisper_model, device="cpu", compute_type="int8"
                    )
                    logger.info("[asr] whisper 模型就绪")
        return self._model

    def transcribe_pcm16(self, pcm: bytes, language: str | None = None) -> str:
        """PCM16/16k/单声道 → 文本（阻塞调用，请在工作线程中运行）。"""
        if len(pcm) < 2:
            return ""
        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        if float(np.abs(samples).max(initial=0.0)) < 1e-4:
            return ""
        model = self._ensure_model()
        segments, _info = model.transcribe(
            samples,
            language=language if language in ("zh", "ja", "en") else "zh",
            beam_size=1,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        text = "".join(seg.text for seg in segments).strip()
        return text


def pcm_rms(pcm: bytes) -> float:
    """PCM16 → RMS（0.0~1.0），供 VAD 判定。"""
    if len(pcm) < 2:
        return 0.0
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
    return float(np.sqrt(np.mean(np.square(samples))) / 32768.0)
