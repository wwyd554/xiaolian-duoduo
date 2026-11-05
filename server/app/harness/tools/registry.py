from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass, field
from typing import Callable, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..context import encode, estimate_tokens
from ..hooks import pre_tool, post_tool
from ..policy import ToolDenied, authorize, public_error
from ..safety import SafetyViolation, check_tree
from ..state import PracticeState, Fact
from .knowledge import retrieve


class NoArguments(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class FactArguments(NoArguments):
    messageId: str = Field(min_length=1, max_length=100)
    quote: str = Field(min_length=2, max_length=400)
    type: Literal["need", "budget", "objection", "decision_maker", "commitment"]


class KnowledgeArguments(NoArguments):
    query: str = Field(min_length=1, max_length=160)


@dataclass
class ToolContext:
    state: PracticeState
    user_id: str
    messages: list[dict]
    role: str = "npc"
    audit_database_path: str = ""
    pending_facts: list[Fact] = field(default_factory=list)
    pending_audits: list[str] = field(default_factory=list)
    calls: int = 0


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    arguments: type[BaseModel]
    effect: Literal["read", "business_write", "external_sensitive"]
    roles: frozenset[str]
    handler: Callable


def scenario(context, _):
    return {k: context.state.scenario.get(k) for k in ("title", "description", "npc", "goals")}


def state(context, _):
    return {"turn": context.state.turn, "stage": context.state.stage,
            "customerState": context.state.customerState,
            "goals": [g.model_dump() for g in context.state.goalStatuses],
            "facts": [f.model_dump() for f in context.state.facts[-20:]],
            "omittedFacts": max(0, len(context.state.facts) - 20)}


def record_fact(context, arguments):
    message = next((m for m in context.messages if m["id"] == arguments.messageId), None)
    if not message or message["role"] not in ("user", "npc"):
        raise ToolDenied("unknown_evidence")
    sentences = [s.strip() for s in re.findall(r"[^。！？!?\n]+[。！？!?]?", message["content"])]
    if arguments.quote not in sentences or arguments.quote.endswith(("?", "？")):
        raise ToolDenied("invalid_evidence")
    fact = Fact(id=hashlib.sha256(encode([arguments.messageId, arguments.type, arguments.quote]).encode()).hexdigest()[:24],
                type=arguments.type, value=arguments.quote, evidenceMessageId=arguments.messageId,
                speaker=message["role"], certainty="uncertain" if re.search(
                    r"可能|大概|不确定|如果|也许|还没|未定|不清楚|听说", arguments.quote) else "statement")
    # Staged only; runtime commits evidence and messages together after concurrency checks.
    return {"status": "staged", "fact": fact.model_dump()}


CATALOG = {spec.name: spec for spec in (
    ToolSpec("get_scenario_context", "读取本场固定的场景与客户资料。", NoArguments, "read", frozenset({"npc"}), scenario),
    ToolSpec("get_session_state", "读取本场指标、目标和最近事实；不修改状态。", NoArguments, "read", frozenset({"npc"}), state),
    ToolSpec("retrieve_sales_knowledge", "关键词查询本地训练规则（非企业资料或外部搜索），返回来源和版本。", KnowledgeArguments,
             "read", frozenset({"npc"}), retrieve),
    ToolSpec("record_customer_fact", "按来源消息完整原句暂存事实，不得将销售说法当客户确认。", FactArguments,
             "business_write", frozenset({"npc"}), record_fact),
)}


def schemas():
    return [{"name": s.name, "description": s.description, "input_schema": s.arguments.model_json_schema()}
            for s in CATALOG.values()]


def execute(context: ToolContext, name: str, arguments: dict, *, allow_execution: bool = True) -> dict:
    spec = CATALOG.get(name)
    label = spec.name if spec else "unregistered"
    started = time.monotonic()
    # No raw argument values, attacker-controlled tool labels or provider errors in audits.
    audit = pre_tool(context, label, spec.effect if spec else "unknown", estimate_tokens(encode(arguments)))
    context.calls += 1
    try:
        if context.calls > 4 or not allow_execution:
            raise ToolDenied("tool_budget_exceeded")
        if not spec:
            raise ToolDenied("unknown_tool")
        authorize(context, spec)
        parsed = spec.arguments.model_validate(arguments)
        check_tree(arguments, "tool_input")
        result = spec.handler(context, parsed)
        check_tree(result, "tool_output")
        if estimate_tokens(encode(result)) > 6000:
            raise ToolDenied("result_budget_exceeded")
    except (ToolDenied, ValidationError, SafetyViolation) as exc:
        reason = public_error(exc)
        post_tool(context, audit, label, "denied", reason, started)
        return {"error": reason}
    except Exception:
        post_tool(context, audit, label, "failed", "handler_failure", started)
        raise
    status = "staged" if spec.effect == "business_write" else "completed"
    post_tool(context, audit, label, status, "validated", started)
    if status == "staged":
        context.pending_facts.append(Fact.model_validate(result["fact"]))
        context.pending_audits.append(audit)
    return {"result": result}
