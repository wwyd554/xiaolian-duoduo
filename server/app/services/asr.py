"""ASR 服务（阶段 3）：faster-whisper 本地识别（开发期）。

- 模型懒加载（首次使用才下载/加载），CPU int8 量化
- 输入约定：PCM16 / 16kHz / 单声道（与前端 TranscribeService 采集参数一致）
- 后续切换火山引擎流式 ASR 时替换本模块，WebSocket 路由契约不变
"""
from __future__ import annotations

import logging
import threading
import io
import math
from pathlib import Path

import numpy as np

from ..config import settings

logger = logging.getLogger("app.asr")
RECORDING_FORMATS = {
    ".mp3": "mp3", ".wav": "wav", ".m4a": "mov", ".aac": "aac",
    ".ogg": "ogg", ".flac": "flac", ".webm": "matroska",
}


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

    def _ensure_model(self, *, local_files_only: bool = False):
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    from faster_whisper import WhisperModel

                    logger.info("[asr] 加载 whisper 模型: %s (cpu/int8)", settings.whisper_model)
                    self._model = WhisperModel(
                        settings.whisper_model, device="cpu", compute_type="int8",
                        local_files_only=local_files_only
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


    def transcribe_file(self, path: str, language: str = "zh", *,
                        cancel: threading.Event | None = None,
                        max_duration: float = 900) -> dict:
        """Decode an uploaded recording locally and return timed text without guessing speakers."""
        cancel = cancel or threading.Event()
        samples = decode_recording(path, cancel, max_duration)
        check_cancelled(cancel)
        try:
            # A recording never triggers a model download or a cloud transcription request.
            model = self._ensure_model(local_files_only=True)
        except Exception as exc:
            logger.warning("[asr] local_model_unavailable error_type=%s", type(exc).__name__)
            raise RecordingTranscriptionError(
                503, "本地语音模型尚未就绪，请完成本地模型安装后重试。"
            ) from None
        check_cancelled(cancel)
        segments, info = model.transcribe(
            samples, language=None if language == "auto" else language,
            beam_size=3, vad_filter=True, condition_on_previous_text=False,
        )
        result = []
        text_length = 0
        for segment in segments:
            check_cancelled(cancel)
            text = segment.text.strip()
            if not text:
                continue
            text_length += len(text)
            if text_length > 30000:
                raise RecordingTranscriptionError(422, "转写结果超过 30000 字，请把录音分段后导入。")
            result.append({"start": round(float(segment.start), 2),
                           "end": round(float(segment.end), 2), "text": text})
        check_cancelled(cancel)
        if not result:
            raise RecordingTranscriptionError(422, "没有识别到清晰语音，请检查录音内容或换一个文件。")
        # Keep the complete transcript within the existing review editor's 200-row limit.
        if len(result) > 200:
            group_size = math.ceil(len(result) / 200)
            result = [{"start": group[0]["start"], "end": group[-1]["end"],
                       "text": " ".join(item["text"] for item in group)}
                      for start in range(0, len(result), group_size)
                      if (group := result[start:start + group_size])]
        if sum(len(item["text"]) for item in result) > 30000:
            raise RecordingTranscriptionError(422, "转写结果超过 30000 字，请把录音分段后导入。")
        if any(len(item["text"]) > 4000 for item in result):
            raise RecordingTranscriptionError(422, "单段转写超过 4000 字，请把录音分段后导入。")
        return {"text": "\n".join(item["text"] for item in result), "segments": result,
                "durationSeconds": round(len(samples) / 16000, 2), "language": info.language}


class RecordingTranscriptionError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class TranscriptionCancelled(Exception):
    """The client stopped waiting; the worker cleans up when its current inference ends."""


def check_cancelled(cancel: threading.Event) -> None:
    if cancel.is_set():
        raise TranscriptionCancelled()


def decode_recording(path: str, cancel: threading.Event, max_duration: float) -> np.ndarray:
    """Bound decoding by actual sample count, including files with missing/incorrect duration."""
    import av

    input_format = RECORDING_FORMATS.get(Path(path).suffix.lower())
    if input_format is None:
        raise RecordingTranscriptionError(415, "录音文件格式不受支持。")
    sample_rate = 16000
    max_samples = int(sample_rate * max_duration)
    sample_count = 0
    buffer = io.BytesIO()
    resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=sample_rate)

    def append_frames(frames):
        nonlocal sample_count
        for frame in frames:
            check_cancelled(cancel)
            sample_count += frame.samples
            if sample_count > max_samples:
                raise RecordingTranscriptionError(422, "录音最长支持 15 分钟，请分段后导入。")
            buffer.write(frame.to_ndarray().tobytes())

    try:
        # Only the local, randomly named temporary file is passed to the decoder.
        with av.open(path, mode="r", format=input_format, metadata_errors="ignore",
                     options={"protocol_whitelist": "file,pipe", "enable_drefs": "0"}) as container:
            if not container.streams.audio:
                raise RecordingTranscriptionError(422, "文件中没有音轨，请选择有效录音文件。")
            if container.duration is not None and container.duration / av.time_base > max_duration + 0.1:
                raise RecordingTranscriptionError(422, "录音最长支持 15 分钟，请分段后导入。")
            for frame in container.decode(audio=0):
                check_cancelled(cancel)
                frame.pts = None
                append_frames(resampler.resample(frame))
            append_frames(resampler.resample(None))
    except (av.FFmpegError, ValueError, OSError):
        raise RecordingTranscriptionError(422, "无法读取这段录音，请确认文件完整或转换成 MP3、WAV 后重试。") from None
    check_cancelled(cancel)
    samples = np.frombuffer(buffer.getbuffer(), dtype=np.int16).astype(np.float32) / 32768.0
    if len(samples) < 1600 or float(np.abs(samples).max(initial=0.0)) < 1e-4:
        raise RecordingTranscriptionError(422, "录音为空、过短或没有声音，请换一个文件。")
    return samples


def pcm_rms(pcm: bytes) -> float:
    """PCM16 → RMS（0.0~1.0），供 VAD 判定。"""
    if len(pcm) < 2:
        return 0.0
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
    return float(np.sqrt(np.mean(np.square(samples))) / 32768.0)
