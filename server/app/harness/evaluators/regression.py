"""Synthetic dialogue contract tests; --live adds real model output for human review.

Offline tests validate wiring, not model intelligence. Live heuristics flag obvious
regressions only; passing them is not a role-consistency or safety certification.
"""
import argparse
import json
import sqlite3
import time
import uuid
from pathlib import Path
from unittest.mock import patch
from contextlib import nullcontext

from ...agents.prompts import build_npc_system_prompt
from ...agents.scoring import parse_scoring_output
from ...services.conversation import HISTORY_LIMIT, _run_npc_turn, _run_scoring
from ..observability import trace_id, capture_events
from .measurements import summarize_usage
from ...database import SCHEMA
from ...models import SendMessageRequest
from ..runtime import run_turn
from ..safety import is_role_override

FIXTURES = Path(__file__).resolve().parents[3] / "tests/fixtures/dialogue_regression.json"


def load_cases():
    return json.loads(FIXTURES.read_text(encoding="utf-8"))


def run_legacy_case(catalog: dict, case: dict, *, live=False) -> dict:
    token = trace_id.set(uuid.uuid4().hex)
    started = time.monotonic()
    scores = {"angerLevel": 2, "trustLevel": 5, "progressLevel": 3}
    goals = [{"id": "confirm-demo", "description": "客户明确同意具体演示时间", "achieved": False}]
    history = case["history"][-HISTORY_LIMIT:]
    system = build_npc_system_prompt(catalog["npc"], scores, scenario_description=catalog["scenario"])
    try:
        if live:
            reply = _run_npc_turn(system, history, case["input"])
            scoring = _run_scoring(case["input"], history, scores, goals, catalog["scenario"], "zh")
        else:
            # Verify the same production adapter receives the role/message contract.
            with patch("app.services.conversation.call_model", return_value=case["example"]) as model:
                reply = _run_npc_turn(system, history, case["input"])
                passed = model.call_args.kwargs
                assert passed["system"] == system
                assert passed["messages"][-1] == {"role": "user", "content": case["input"]}
                assert [m["role"] for m in passed["messages"][:-1]] == [
                    "user" if m["sender"] == "user" else "assistant" for m in history]
            expected = {**scores, "analysis": "测试评分", "goalUpdates": [
                {"goalId": "confirm-demo", "achieved": False, "reason": "未确认具体日期"}]}
            with patch("app.services.conversation.call_model", return_value=json.dumps(expected)):
                scoring = _run_scoring(case["input"], history, scores, goals, catalog["scenario"], "zh")
            assert scoring["scores"] == scores
            assert parse_scoring_output("broken json", scores)["scores"] == scores
        issues = [f"出现禁止片段：{phrase}" for phrase in case["forbidden"] if phrase in reply]
        if not reply.strip():
            issues.append("回复为空")
        if case["id"] == "goal-boundary" and any(u["achieved"] for u in scoring["goalUpdates"]):
            issues.append("未确认时间却判定约见目标达成")
        if case["id"] == "asr-noise" and any(abs(scoring["scores"][k] - scores[k]) > 1 for k in scores):
            issues.append("转写噪声导致过大评分变化")
        result = {"id": case["id"], "mode": "live" if live else "contract",
                  "checksPassed": not issues, "issues": issues, "traceId": trace_id.get(),
                  "elapsedMs": round((time.monotonic() - started) * 1000),
                  "modelQuality": "requires_human_review" if live else "not_run",
                  "reviewCriteria": case["criteria"]}
        if "knownGap" in case:
            result["knownGap"] = case["knownGap"]
        if live:
            result.update(reply=reply, scoring=scoring)
        return result
    except Exception as exc:
        return {"id": case["id"], "checksPassed": False, "errorType": type(exc).__name__,
                "traceId": trace_id.get(), "modelQuality": "not_evaluated", "elapsedMs": round((time.monotonic() - started) * 1000)}
    finally:
        trace_id.reset(token)


def run_case(catalog: dict, case: dict, *, live=False) -> dict:
    with capture_events() as events:
        result = _run_case(catalog, case, live=live)
    result["measurements"] = summarize_usage(events)
    return result


def _run_case(catalog: dict, case: dict, *, live=False) -> dict:
    """Exercise production runtime with an isolated temporary DB, including tool audits."""
    import tempfile
    token = trace_id.set(uuid.uuid4().hex)
    started = time.monotonic()
    directory = tempfile.TemporaryDirectory()
    conn = sqlite3.connect(str(Path(directory.name) / "fixture.db"))
    conn.row_factory = sqlite3.Row
    scores = {"angerLevel": 2, "trustLevel": 5, "progressLevel": 3}
    calls = []
    def model(**kwargs):
        calls.append(kwargs)
        if kwargs["label"] == "npc-conversation":
            return case["example"]
        if kwargs["label"] == "realtime-scoring":
            return json.dumps({**scores, "analysis": "离线契约替身", "goalUpdates": []})
        return json.dumps({"outcome": "continue", "goals": [{"goalId": "confirm-demo", "achieved": False,
                           "reason": "客户未确认演示日期", "confidence": 0.9, "evidence": []}]})
    try:
        conn.executescript(SCHEMA)
        scene = {"npc": catalog["npc"], "description": catalog["scenario"], "initialMetrics": scores,
                 "goals": [{"id": "confirm-demo", "description": "客户明确同意具体演示时间", "isRequired": True}]}
        conn.execute("INSERT INTO scenarios(id,data) VALUES ('fixture',?)", (json.dumps(scene),))
        conn.execute("INSERT INTO sessions VALUES ('fixture','tester','fixture','合成用例','active',NULL,'t','t')")
        for i, message in enumerate(case["history"]):
            conn.execute("INSERT INTO messages(id,session_id,role,content,created_at) VALUES (?,'fixture',?,?,?)",
                         (f"fixture-{i}", message["sender"], message["content"], f"{i:04}"))
        conn.commit()
        with nullcontext() if live else patch("app.harness.runtime.call_model", side_effect=model):
            output = run_turn(conn, conn.execute("SELECT * FROM sessions").fetchone(), SendMessageRequest(content=case["input"]), "tester")
        conn.commit()
        reply = output["response"]
        issues = [f"出现禁止片段：{phrase}" for phrase in case["forbidden"] if phrase in reply]
        if not reply.strip():
            issues.append("回复为空")
        allowed_statuses = {"completed", "policy_unchanged"} if is_role_override(case["input"]) else {"completed"}
        if output["evaluationStatus"] not in allowed_statuses or output["scoringStatus"] not in allowed_statuses:
            issues.append("评分或独立评估不可用，不能视为质量评测成功")
        if case["id"] == "goal-boundary" and any(g["achieved"] for g in output["goalUpdates"]):
            issues.append("未确认具体日期就标记达成")
        if case["id"] == "asr-noise" and any(abs(output["metrics"][k] - scores[k]) > 1 for k in scores):
            issues.append("噪声引起评分大幅变化")
        if case["id"] == "early-fact":
            if live and not any(v in reply for v in ("五万", "5万", "50,000", "50000")):
                issues.append("未承接早期预算五万元")
            if not live and not all("五万元" in json.dumps(c["messages"], ensure_ascii=False) for c in calls):
                issues.append("早期事实未进入所有模型上下文")
        if not live:
            if is_role_override(case["input"]):
                assert not any(c["label"] == "npc-conversation" for c in calls)
                assert len(calls) == 0
            else:
                npc = next(c for c in calls if c["label"] == "npc-conversation")
                assert npc["messages"][-1] == {"role": "user", "content": case["input"]}
                assert len(calls) == 3
            assert output["metrics"] == scores
        result = {"id": case["id"], "runtime": "stateful", "mode": "live" if live else "contract",
                  "checksPassed": not issues, "issues": issues, "traceId": trace_id.get(),
                  "elapsedMs": round((time.monotonic() - started) * 1000),
                  "modelQuality": "requires_human_review" if live else "not_run", "reviewCriteria": case["criteria"],
                  "npcResponseSource": "policy" if is_role_override(case["input"]) else ("model" if live else "fixture")}
        if live:
            result.update(reply=reply, scores=output["metrics"], goals=output["goalUpdates"],
                          evaluationStatus=output["evaluationStatus"],
                          scoringStatus=output["scoringStatus"],
                          tools=[dict(row) for row in conn.execute(
                              "SELECT tool,effect,status,reason,argument_bytes,elapsed_ms FROM tool_audits ORDER BY created_at")])
        return result
    except Exception as exc:
        return {"id": case["id"], "checksPassed": False, "errorType": type(exc).__name__,
                "traceId": trace_id.get(), "modelQuality": "not_evaluated",
                "elapsedMs": round((time.monotonic() - started) * 1000)}
    finally:
        conn.close()
        directory.cleanup()
        trace_id.reset(token)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="调用真实模型（产生费用），输出合成用例的回复供人工抽检")
    parser.add_argument("--case", help="只运行指定用例 ID")
    parser.add_argument("--legacy", action="store_true", help="对照阶段 A 固定工作流的模型适配契约")
    args = parser.parse_args()
    catalog = load_cases()
    cases = [c for c in catalog["cases"] if not args.case or c["id"] == args.case]
    if not cases:
        parser.error("未找到指定用例")
    runner = run_legacy_case if args.legacy else run_case
    results = [runner(catalog, case, live=args.live) for case in cases]
    print(json.dumps({"fixtureVersion": catalog["version"], "total": len(results),
                      "passed": sum(r["checksPassed"] for r in results), "results": results}, ensure_ascii=False, indent=2))
    return 0 if all(r["checksPassed"] for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
