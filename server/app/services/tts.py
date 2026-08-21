"""TTS 服务（阶段 3）：edge-tts 开发期实现。

接口形状按"文本 + voiceId → (音频, visemes)"设计，后续切换火山引擎 TTS
（豆包音色，原生提供口型时间戳）时只需替换本模块内部实现，路由契约不变。

要点：
- 前端 PollyService 发来的是 Polly 风格 SSML（<speak><prosody rate="1.25">…</prosody>），
  需解析出语速并剥掉标签
- 场景库 voiceId 只有 Kazuha（日文女声），映射到中文女声；前端兜底 Takumi → 中文男声
- viseme：edge-tts 词边界时间戳 + 汉字→母音伪映射（值取 a/i/u/e/o，前端直通映射）
"""
from __future__ import annotations

import html
import logging
import re

import edge_tts

logger = logging.getLogger("app.tts")

# 原 Polly voiceId → edge-tts 音色（音色可经 TTS_VOICE_* 环境变量覆盖）
VOICE_MAP = {
    "Kazuha": "zh-CN-XiaoxiaoNeural",  # 女声（场景库唯一在用音色）
    "Takumi": "zh-CN-YunxiNeural",     # 男声（AudioService 未传 voiceId 时的兜底）
    "Mizuki": "zh-CN-XiaoyiNeural",    # 女声（年轻）
}

# 按语言兜底（languageCode 前缀）
LANGUAGE_VOICE = {
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "en": "en-US-JennyNeural",
}

_DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"

# <prosody rate="1.25">text</prosody>
_PROSODY_RE = re.compile(r"<prosody[^>]*rate=\"([0-9.]+)\"[^>]*>(.*?)</prosody>", re.S)
_TAG_RE = re.compile(r"<[^>]+>")

# viseme 伪映射：汉字按码位散列到五个母音（无拼音库时的口型近似，够用）
_VOWELS = "aiueo"
_ASCII_VOWELS = set("aeiouAEIOU")


def parse_ssml(text: str) -> tuple[str, int]:
    """从 Polly SSML 提取纯文本与语速百分比（1.25 → +25）。

    输入不是合法 SSML（textType=text）时原样返回。
    """
    rate_pct = 0
    m = _PROSODY_RE.search(text)
    if m:
        try:
            rate_pct = int(round((float(m.group(1)) - 1.0) * 100))
        except ValueError:
            rate_pct = 0
        text = m.group(2)
    plain = html.unescape(_TAG_RE.sub("", text)).strip()
    return plain, rate_pct


def _char_to_viseme(ch: str) -> str:
    if "\u4e00" <= ch <= "\u9fff":
        return _VOWELS[ord(ch) % 5]
    if ch in _ASCII_VOWELS:
        return ch.lower()
    return "sil"


def build_visemes(marks: list[tuple[float, float, str]]) -> list[dict]:
    """词边界 → Polly 风格 viseme 列表（{time: ms, type: 'viseme', value}）。"""
    out: list[dict] = []
    for start_ms, dur_ms, word in marks:
        chars = [c for c in word if not c.isspace()]
        if not chars:
            continue
        step = dur_ms / len(chars)
        for i, c in enumerate(chars):
            out.append({"time": int(start_ms + i * step), "type": "viseme", "value": _char_to_viseme(c)})
        out.append({"time": int(start_ms + dur_ms), "type": "viseme", "value": "sil"})
    return out


def resolve_voice(voice_id: str | None, language_code: str | None) -> str:
    if voice_id and voice_id in VOICE_MAP:
        return VOICE_MAP[voice_id]
    lang = (language_code or "zh").split("-")[0].lower()
    return LANGUAGE_VOICE.get(lang, _DEFAULT_VOICE)


async def synthesize(
    text: str,
    voice_id: str | None = None,
    language_code: str | None = None,
) -> tuple[bytes, list[dict]]:
    """文本 → (mp3 字节, viseme 列表)。失败抛异常，由路由层兜底。"""
    plain, rate_pct = parse_ssml(text)
    if not plain:
        return b"", []

    voice = resolve_voice(voice_id, language_code)
    communicate = edge_tts.Communicate(
        plain,
        voice,
        rate=f"{rate_pct:+d}%",
        boundary="WordBoundary",
    )

    audio = bytearray()
    marks: list[tuple[float, float, str]] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            # offset/duration 单位是 100ns
            marks.append((chunk["offset"] / 1e4, chunk["duration"] / 1e4, chunk["text"]))

    logger.info(
        "[tts] voice=%s rate=%+d%% chars=%d audio=%dB marks=%d",
        voice, rate_pct, len(plain), len(audio), len(marks),
    )
    return bytes(audio), build_visemes(marks)
