"""评分输出解析 —— 替代原 Strands structured_output。

DeepSeek Anthropic 兼容端点不支持结构化输出参数，
故由提示词强制 JSON 输出，此模块负责提取 + 校验 + 容错回退。
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger("scoring")

DEFAULT_SCORES = {"angerLevel": 1, "trustLevel": 1, "progressLevel": 1}


def _clamp_int(value: Any, default: int, lo: int = 1, hi: int = 10) -> int:
    try:
        v = int(float(value))
        return max(lo, min(hi, v))
    except (TypeError, ValueError):
        return default


def _clamp_float(value: Any, default: float, lo: float = 0.0, hi: float = 1.0) -> float:
    try:
        v = float(value)
        return max(lo, min(hi, v))
    except (TypeError, ValueError):
        return default


def _extract_json(text: str) -> dict | None:
    """从模型输出中提取 JSON 对象（容忍 markdown 代码块、前后缀文本）。"""
    if not text:
        return None
    # 1) 优先直接解析整段
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    # 2) 提取 ```json ... ``` 代码块
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        try:
            parsed = json.loads(fence.group(1))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    # 3) 提取第一个 { ... } 平衡括号块
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        parsed = json.loads(text[start : i + 1])
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        pass
                    break
    return None


def parse_scoring_output(
    model_text: str,
    fallback_scores: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """解析评分输出，字段缺失/非法时回退默认值。

    Returns:
        {
          "scores": {"angerLevel","trustLevel","progressLevel"},
          "analysis": str,
          "goalUpdates": [{"goalId","achieved","reason"}],
          "npcEmotion": str,
          "npcEmotionIntensity": float,
          "gesture": str,
          "suggestions": [str],
        }
    """
    data = _extract_json(model_text)
    if data is None:
        logger.warning("评分输出无法解析为 JSON，沿用当前分数。原始输出: %s", model_text[:200])
        return _empty_result(fallback_scores)

    scores = {
        "angerLevel": _clamp_int(data.get("angerLevel"), DEFAULT_SCORES["angerLevel"]),
        "trustLevel": _clamp_int(data.get("trustLevel"), DEFAULT_SCORES["trustLevel"]),
        "progressLevel": _clamp_int(data.get("progressLevel"), DEFAULT_SCORES["progressLevel"]),
    }

    analysis = str(data.get("analysis", ""))[:200]

    goal_updates = []
    raw_updates = data.get("goalUpdates")
    if isinstance(raw_updates, list):
        for upd in raw_updates:
            if not isinstance(upd, dict) or not upd.get("goalId"):
                continue
            goal_updates.append({
                "goalId": str(upd["goalId"]),
                "achieved": bool(upd.get("achieved", False)),
                "reason": str(upd.get("reason", "") or ""),
            })

    suggestions_raw = data.get("suggestions")
    suggestions = (
        [str(s)[:60] for s in suggestions_raw if str(s).strip()][:4]
        if isinstance(suggestions_raw, list)
        else []
    )

    emotion = data.get("npcEmotion", "neutral")
    if emotion not in ("happy", "angry", "sad", "relaxed", "neutral"):
        emotion = "neutral"

    gesture = data.get("gesture", "none")
    if gesture not in ("nod", "headTilt", "none"):
        gesture = "none"

    return {
        "scores": scores,
        "analysis": analysis,
        "goalUpdates": goal_updates,
        "npcEmotion": emotion,
        "npcEmotionIntensity": _clamp_float(data.get("npcEmotionIntensity"), 0.5),
        "gesture": gesture,
        "suggestions": suggestions,
    }


def _empty_result(fallback_scores: dict[str, Any] | None = None) -> dict[str, Any]:
    source = fallback_scores or DEFAULT_SCORES
    return {
        "scores": {
            key: _clamp_int(source.get(key), default)
            for key, default in DEFAULT_SCORES.items()
        },
        "analysis": "",
        "goalUpdates": [],
        "npcEmotion": "neutral",
        "npcEmotionIntensity": 0.5,
        "gesture": "none",
        "suggestions": [],
    }
