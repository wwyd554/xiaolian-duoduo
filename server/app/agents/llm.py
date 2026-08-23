"""LLM 调用底座 —— 基于 agent-blueprint/scaffold/agent.py 精简。

保留核心：外部化配置、结构化日志、重试+退避+超时、轨迹采集。
模型：DeepSeek（官方 Anthropic 兼容端点），单客户端双配置，模型名由 .env 指定（不写死）：
  - chat 模型（llm_chat_model）     ：对话 + 实时评分 + 合规检查 + 场景生成
  - reasoner 模型（llm_reasoner_model）：反馈报告 + 目标判断 + 记忆提取
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

from anthropic import Anthropic, APIConnectionError, APIStatusError, APITimeoutError

from ..config import settings

logger = logging.getLogger("llm")

# DeepSeek Anthropic 兼容端点
ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic"

_client: Anthropic | None = None
_trajectory_dir = Path(__file__).resolve().parent.parent.parent / ".trajectories"


def get_client() -> Anthropic:
    global _client
    if _client is None:
        if not settings.deepseek_api_key:
            raise RuntimeError("未配置 DEEPSEEK_API_KEY（请在 server/.env 中填写）")
        _client = Anthropic(
            api_key=settings.deepseek_api_key,
            base_url=ANTHROPIC_BASE_URL,
        )
    return _client


def _backoff(attempt: int) -> float:
    return settings.llm_base_delay_seconds * (2 ** attempt)


def record_trajectory(entry: dict[str, Any]) -> None:
    """轨迹采集：JSONL 追加（未来微调原始素材）。失败不影响主流程。"""
    try:
        _trajectory_dir.mkdir(parents=True, exist_ok=True)
        path = _trajectory_dir / f"trajectory-{time.strftime('%Y%m%d')}.jsonl"
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as exc:  # noqa: BLE001
        logger.warning("轨迹写入失败: %s", exc)


def call_model(
    *,
    system: str,
    messages: list[dict],
    model: str | None = None,
    max_tokens: int | None = None,
    temperature: float = 0.7,
    label: str = "call",
) -> str:
    """调用 LLM，返回文本。

    Args:
        system: 系统提示词
        messages: 对话消息 [{role: user/assistant, content: str}]
        model: 覆盖默认模型（chat / reasoner）
        max_tokens: 覆盖默认上限
        temperature: 预留参数。DeepSeek 的 Anthropic 兼容端点暂不支持 temperature，
            传递会被拒绝，故此处保留签名但实际不发送。
        label: 轨迹/日志标记（如 npc-conversation / realtime-scoring）
    """
    model = model or settings.llm_chat_model
    if not model:
        raise RuntimeError(
            "未配置 LLM 模型：请在 server/.env 中设置 LLM_CHAT_MODEL"
            "（以及报告用的 LLM_REASONER_MODEL），例如 LLM_CHAT_MODEL=deepseek-v4-flash"
        )
    max_tokens = max_tokens or settings.llm_max_tokens
    client = get_client()

    last_error: Exception | None = None
    for attempt in range(settings.llm_max_retries):
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "system": system,
                "messages": messages,
                "max_tokens": max_tokens,
                "timeout": settings.llm_timeout_seconds,
            }

            start = time.time()
            response = client.messages.create(**kwargs)
            elapsed = time.time() - start

            text = "".join(
                block.text for block in response.content if getattr(block, "type", None) == "text"
            ).strip()

            record_trajectory({
                "ts": time.time(),
                "label": label,
                "model": model,
                "elapsed_s": round(elapsed, 2),
                "system_preview": system[:200],
                "input_preview": json.dumps(messages[-1])[:500],
                "output_preview": text[:500],
            })
            logger.info("[%s] model=%s elapsed=%.1fs input_tokens=%s output_tokens=%s",
                        label, model, elapsed,
                        getattr(response.usage, "input_tokens", None),
                        getattr(response.usage, "output_tokens", None))
            return text

        except (APITimeoutError, APIConnectionError, APIStatusError) as exc:
            last_error = exc
            delay = _backoff(attempt)
            logger.warning("[%s] 模型调用失败 (attempt %d/%d): %s；%.1fs 后重试",
                           label, attempt + 1, settings.llm_max_retries, exc, delay)
            time.sleep(delay)

    raise RuntimeError(f"模型调用在 {settings.llm_max_retries} 次尝试后失败: {last_error}")
