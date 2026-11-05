"""LLM 调用底座 —— 基于 agent-blueprint/scaffold/agent.py 精简。

保留核心：外部化配置、结构化日志、重试+退避+超时、轨迹采集。
模型：DeepSeek（官方 Anthropic 兼容端点），单客户端双配置，模型名由 .env 指定（不写死）：
  - chat 模型（llm_chat_model）     ：对话 + 实时评分 + 合规检查 + 场景生成
  - reasoner 模型（llm_reasoner_model）：反馈报告 + 目标判断 + 记忆提取
"""
from __future__ import annotations

import logging
import time
from typing import Any

from anthropic import Anthropic, APIConnectionError, APIStatusError, APITimeoutError

from ..config import settings
from ..harness.observability import current_trace, emit, trace_id
from ..harness.budget import active_budget

logger = logging.getLogger("llm")

# DeepSeek Anthropic 兼容端点
ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic"

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        if not settings.deepseek_api_key:
            raise RuntimeError("未配置 DEEPSEEK_API_KEY（请在 server/.env 中填写）")
        _client = Anthropic(
            api_key=settings.deepseek_api_key,
            base_url=ANTHROPIC_BASE_URL,
            max_retries=0,  # Retry budget is owned by this module, not multiplied by the SDK.
        )
    return _client


def _backoff(attempt: int) -> float:
    return settings.llm_base_delay_seconds * (2 ** attempt)


def record_trajectory(entry: dict[str, Any]) -> None:
    """兼容旧调用；只保留观测白名单字段，不再写入对话内容。"""
    emit("model_call", **entry)


def call_model(
    *,
    system: str,
    messages: list[dict],
    model: str | None = None,
    max_tokens: int | None = None,
    temperature: float = 0.7,
    label: str = "call",
    tools: list[dict] | None = None,
    tool_choice: dict | None = None,
) -> str | dict:
    """调用 LLM；普通调用返回文本，启用原生工具时返回文本和工具块。

    Args:
        system: 系统提示词
        messages: 对话消息 [{role: user/assistant, content: str}]
        model: 覆盖默认模型（chat / reasoner）
        max_tokens: 覆盖默认上限
        temperature: 保留兼容签名，当前不发送；思考模式下供应商忽略该参数。
        label: 轨迹/日志标记（如 npc-conversation / realtime-scoring）
        tools: 可选的原生工具定义；定义本身也计入共享输入预算
        tool_choice: 原生工具选择约束，默认 auto
    """
    model = model or settings.llm_chat_model
    if not model:
        raise RuntimeError(
            "未配置 LLM 模型：请在 server/.env 中设置 LLM_CHAT_MODEL"
            "（以及报告用的 LLM_REASONER_MODEL），例如 LLM_CHAT_MODEL=deepseek-v4-flash"
        )
    max_tokens = max_tokens or settings.llm_max_tokens
    client = get_client()

    trace_token = trace_id.set(current_trace())
    try:
        return _call_with_retries(client, system, messages, model, max_tokens, label, tools, tool_choice)
    finally:
        trace_id.reset(trace_token)


def _call_with_retries(client, system, messages, model, max_tokens, label, tools=None, tool_choice=None):
    last_error: Exception | None = None
    for attempt in range(settings.llm_max_retries):
        budget = active_budget.get()
        if budget is not None:
            import json
            budget.reserve(system + (json.dumps(tools, ensure_ascii=False) if tools else ""), messages, max_tokens)
        start = time.monotonic()
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "system": system,
                "messages": messages,
                "max_tokens": max_tokens,
                "timeout": settings.llm_timeout_seconds,
            }
            thinking = "inherit"
            if label in {"npc-conversation", "realtime-scoring", "goal-completion"}:
                thinking = settings.llm_realtime_thinking
            elif label in {"business-review", "imported-review"}:
                # Reviews need a complete structured response within their token budget.
                # Configure them independently of the latency-sensitive conversation path.
                thinking = settings.llm_review_thinking
            if thinking != "inherit":
                kwargs["extra_body"] = {"thinking": {"type": thinking}}
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = tool_choice or {"type": "auto"}

            response = client.messages.create(**kwargs)
            elapsed = time.monotonic() - start
            usage = {key: getattr(response.usage, key, None) for key in (
                "input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")}

            text = "".join(
                block.text for block in response.content if getattr(block, "type", None) == "text"
            ).strip()
            tool_calls = [{"id": block.id, "name": block.name, "arguments": block.input}
                          for block in response.content if getattr(block, "type", None) == "tool_use"] if tools else []

            if (not text and not tool_calls) or getattr(response, "stop_reason", None) == "max_tokens":
                emit("model_call", label=label, model=model, status="invalid_output", attempt=attempt + 1,
                     elapsed_ms=round(elapsed * 1000), **usage)
                raise ValueError("模型输出为空或被截断")

            record_trajectory({
                "label": label,
                "model": model,
                "elapsed_ms": round(elapsed * 1000),
                "status": "completed", "attempt": attempt + 1,
                **usage,
            })
            logger.info("[%s] model=%s elapsed=%.1fs input_tokens=%s output_tokens=%s",
                        label, model, elapsed,
                        getattr(response.usage, "input_tokens", None),
                        getattr(response.usage, "output_tokens", None))
            if tools:
                return {"text": text, "tool_calls": tool_calls,
                        "content": [block.model_dump(exclude_none=True) for block in response.content]}
            return text

        except (APITimeoutError, APIConnectionError, APIStatusError) as exc:
            last_error = exc
            emit("model_call", label=label, model=model, attempt=attempt + 1,
                 status="failed", error_type=type(exc).__name__, elapsed_ms=round((time.monotonic() - start) * 1000))
            delay = _backoff(attempt)
            logger.warning("[%s] 模型调用失败 attempt=%d error_type=%s", label, attempt + 1, type(exc).__name__)
            # Invalid credentials/requests will not improve with retries.
            if isinstance(exc, APIStatusError) and exc.status_code not in (408, 409, 429) and exc.status_code < 500:
                break
            if attempt + 1 < settings.llm_max_retries:
                time.sleep(delay)

    raise RuntimeError("模型暂时不可用，请稍后重试") from last_error
