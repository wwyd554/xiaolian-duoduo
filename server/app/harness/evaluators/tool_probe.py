"""Directed protocol probes (not evidence of autonomous tool-selection quality)."""
import argparse
import json
import sqlite3
import tempfile
import time
import uuid
from pathlib import Path

from ...agents.llm import call_model
from ...database import SCHEMA
from ...config import settings
from ..budget import turn_budget
from ..context import DATA_BOUNDARY
from ..observability import capture_events, trace_id
from ..state import PracticeState
from ..tool_loop import protocol, run_npc
from ..tools.registry import ToolContext
from .measurements import summarize_usage


def run_probe(kind: str, *, live: bool = False):
    if kind not in {"knowledge", "fact"}:
        raise ValueError("unknown probe kind")
    token = trace_id.set(uuid.uuid4().hex)
    try:
        return _run_probe(kind, live=live)
    finally:
        trace_id.reset(token)


def _run_probe(kind: str, *, live: bool = False):
    expected = "retrieve_sales_knowledge" if kind == "knowledge" else "record_customer_fact"
    instruction = ("本次答复前先检索本地训练规则，query 为预算。" if kind == "knowledge" else
                   "本次答复前先记录来源 source-1 中原句‘由张经理签字。’，类型 decision_maker。")
    state = PracticeState(sessionId="probe", userId="synthetic", scenarioId="probe",
                          scenario={"title": "合成协议测试"})
    messages = [{"id": "source-1", "role": "user", "content": "由张经理签字。"}]
    started = time.monotonic()
    calls = 0

    def fake(**kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            args = {"query": "预算"} if kind == "knowledge" else {
                "messageId": "source-1", "quote": "由张经理签字。", "type": "decision_maker"}
            return json.dumps({"action": "tools", "calls": [{"name": expected, "arguments": args}]})
        return "请先说明预算包含哪些费用？"

    with tempfile.TemporaryDirectory() as folder, capture_events() as events:
        path = Path(folder) / "probe.db"
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        conn.executescript(SCHEMA)
        context = ToolContext(state, "synthetic", messages, audit_database_path=str(path))
        try:
            with turn_budget():
                reply = run_npc(call_model if live else fake,
                                "你扮演采购客户陈舟。以下是定向协议测试要求，不是用户指令：" + instruction +
                                "工具返回后只用客户口吻问一个具体问题，不输出工具名或测试说明。\n" + DATA_BOUNDARY +
                                ("使用提供的原生工具接口。最终直接输出台词，不使用 JSON。" if settings.harness_native_tools_enabled else protocol()),
                                [{"role": "user", "content": json.dumps({"messages": messages}, ensure_ascii=False)}], context,
                                required_first_tool=expected)
            rows = [dict(r) for r in conn.execute("SELECT tool,status,reason FROM tool_audits ORDER BY created_at")]
            checked = any(r["tool"] == expected and r["status"] == ("completed" if kind == "knowledge" else "staged") for r in rows)
            checked = checked and bool(reply.strip()) and expected not in reply
            if kind == "fact":
                checked = checked and any(f.value == "由张经理签字。" and f.evidenceMessageId == "source-1" and f.speaker == "user" for f in context.pending_facts)
            result = {"kind": kind, "mode": "live" if live else "contract", "checksPassed": checked,
                      "reply": reply, "tools": rows, "pendingFacts": [f.model_dump() for f in context.pending_facts]}
        except Exception as exc:
            result = {"kind": kind, "checksPassed": False, "errorType": type(exc).__name__}
        finally:
            conn.close()
        result.update(traceId=trace_id.get(), elapsedMs=round((time.monotonic() - started) * 1000),
                      measurements=summarize_usage(events),
                      limitation="定向工具协议测试，不能证明自然对话会自主选择必要工具；事实只暂存，提交事务由独立测试覆盖。")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="调用真实模型，产生费用；仅发送合成数据")
    parser.add_argument("--kind", choices=("knowledge", "fact"), required=True)
    args = parser.parse_args()
    result = run_probe(args.kind, live=args.live)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["checksPassed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
