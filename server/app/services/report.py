"""复盘报告生成 —— LLM（llm_reasoner_model，模型名由 .env 配置）分析 + 数据聚合（目标状态/情绪趋势）。

端点契约（前端 ResultPage）：先查 analysis-status，再调 analysis-results。
报告按 session_id 持久化（analysis_reports 表），避免重复消耗模型额度。
任务持久化至 jobs；报告结果由带租约校验的 Worker 原子提交。
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from ..database import db
from ..agents.llm import call_model
from ..agents.prompts import REPORT_SYSTEM_PROMPT, build_report_prompt
from ..agents.scoring import _extract_json
from ..config import settings
from ..workers.jobs import enqueue_review
from .business_review import evaluate_business_review, build_rubric_snapshot

logger = logging.getLogger("report")

_EMOTION_KEYS = ("angerLevel", "trustLevel", "progressLevel")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# DB 状态
# ============================================================

def get_analysis_status(session_id: str) -> str:
    """返回 pending / processing / completed / failed。

    无记录或正在生成时，懒触发后台生成并返回 processing（贴合前端轮询契约）。
    """
    with db() as conn:
        row = conn.execute(
            "SELECT status FROM analysis_reports WHERE session_id = ?", (session_id,)
        ).fetchone()
    if not row:
        trigger_async(session_id)
        return "processing"
    status = row["status"]
    if status == "completed" and get_cached_report(session_id) is None:
        return trigger_async(session_id)
    if status in ("pending", "processing"):
        trigger_async(session_id)
        return "processing"
    return status


def trigger_async(session_id: str, *, retry: bool = False) -> str:
    """持久化入队；查询不自动重置已耗尽重试次数的任务。"""
    with db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        return enqueue_review(conn, session_id, retry=retry)


def build_processing_skeleton(session_id: str) -> dict:
    """生成中/未生成时返回的最小骨架，避免前端崩溃并提示轮询。"""
    with db() as conn:
        sess = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        scenario_doc = _session_scenario(conn, sess) if sess else {}
    npc = scenario_doc.get("npc") or {}
    return {
        "success": True,
        "status": "processing",
        "sessionId": session_id,
        "sessionInfo": {
            "sessionId": session_id,
            "scenarioId": sess["scenario_id"] if sess else "",
            "scenarioName": scenario_doc.get("title") or scenario_doc.get("name") or "",
            "npcInfo": {
                "name": npc.get("name", ""),
                "role": npc.get("role", ""),
                "company": npc.get("company", ""),
                "personality": npc.get("personality", []),
            },
        },
        "messages": [],
        "realtimeMetrics": [],
        "complianceViolations": [],
        "feedback": None,
        "finalMetrics": {"angerLevel": "1", "trustLevel": "1", "progressLevel": "1", "analysis": ""},
        "goalResults": {"scenarioGoals": [], "goalStatuses": [], "goalScore": 0},
    }


def get_cached_report(session_id: str) -> dict | None:
    with db() as conn:
        row = conn.execute(
            "SELECT status, report_json FROM analysis_reports WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        if row and row["status"] == "completed" and row["report_json"]:
            try:
                result = json.loads(row["report_json"])
                return result if isinstance(result, dict) else None
            except json.JSONDecodeError:
                return None
    return None


# ============================================================
# 数据读取
# ============================================================

def _load_session(conn, session_id: str) -> dict | None:
    return conn.execute(
        "SELECT * FROM sessions WHERE id = ?", (session_id,)
    ).fetchone()


def _load_scenario_doc(conn, scenario_id: str) -> dict:
    row = conn.execute("SELECT data FROM scenarios WHERE id = ?", (scenario_id,)).fetchone()
    if not row:
        return {}
    try:
        return json.loads(row["data"])
    except json.JSONDecodeError:
        return {}


def _session_scenario(conn, session) -> dict:
    snapshot = conn.execute("SELECT state_json FROM session_states WHERE session_id=?", (session["id"],)).fetchone()
    if snapshot:
        from ..harness.state import PracticeState
        return PracticeState.model_validate_json(snapshot["state_json"]).scenario
    return _load_scenario_doc(conn, session["scenario_id"])


def _load_messages(conn, session_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, role, content, metrics, meta, created_at FROM messages "
        "WHERE session_id = ? ORDER BY created_at ASC, rowid ASC",
        (session_id,),
    ).fetchall()
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "metrics": json.loads(r["metrics"]) if r["metrics"] else None,
            "meta": json.loads(r["meta"]) if r["meta"] else None,
            "created_at": r["created_at"],
        })
    return out


def _build_transcript(messages: list[dict]) -> str:
    lines = []
    for m in messages:
        if m["role"] == "user":
            speaker = "学员"
        elif m["role"] == "npc":
            speaker = "客户"
        else:
            continue
        lines.append(f"{speaker}：{m['content']}")
    return "\n".join(lines)


def _metrics_history(messages: list[dict]) -> list[dict]:
    history = []
    for m in messages:
        if m["role"] == "npc" and m["metrics"]:
            metrics = m["metrics"]
            history.append({
                "angerLevel": metrics.get("angerLevel", 1),
                "trustLevel": metrics.get("trustLevel", 1),
                "progressLevel": metrics.get("progressLevel", 1),
            })
    return history


def _final_goal_statuses(conn, session_id: str, scenario_doc: dict) -> tuple[list[dict], list[dict], float]:
    """从最后一条 NPC 消息的 meta.goalUpdates 恢复最终目标状态。

    Returns:
        (goal_statuses, scenario_goals, goal_score)
        goal_statuses: [{goalId, achieved, achievedAt, progress}]
        scenario_goals: [{id, description, isRequired, priority, criteria}]
    """
    scenario_goals: list[dict] = []
    raw_goals = scenario_doc.get("goals") or []
    for g in raw_goals:
        scenario_goals.append({
            "id": g.get("id", ""),
            "description": g.get("description", ""),
            "isRequired": bool(g.get("isRequired", False)),
            "priority": g.get("priority", 1),
            "criteria": g.get("criteria", []),
        })

    # 取最后一条 NPC 消息的 goalUpdates
    meta = {}
    for m in reversed(_load_messages(conn, session_id)):
        if m["role"] == "npc" and m["meta"]:
            meta = m["meta"]
            break
    updates = meta.get("goalUpdates") or []

    update_map = {}
    for u in updates:
        gid = u.get("goalId") or u.get("id")
        if gid:
            update_map[gid] = u

    goal_statuses: list[dict] = []
    achieved = 0
    for g in scenario_goals:
        gid = g.get("id", "")
        upd = update_map.get(gid, {})
        is_achieved = bool(upd.get("achieved", False))
        # progress：达成为 100；reason 含"部分"给 50；否则 0
        if is_achieved:
            progress = 100
            achieved += 1
        elif isinstance(upd.get("reason"), str) and "部分" in upd["reason"]:
            progress = 50
        else:
            progress = 0
        goal_statuses.append({
            "goalId": gid,
            "description": g.get("description", ""),
            "achieved": is_achieved,
            "achievedAt": None,
            "progress": progress,
            "evidence": upd.get("evidence", []),
            "verified": upd.get("verified", False),
            "reason": upd.get("reason", ""),
        })

    goal_score = round(achieved / len(scenario_goals) * 100) if scenario_goals else 0
    return goal_statuses, scenario_goals, goal_score


# ============================================================
# 生成
# ============================================================

def _parse_report_json(text: str) -> dict:
    data = _extract_json(text)
    if not isinstance(data, dict):
        raise ValueError("报告输出非 JSON 对象")
    scores = data.get("scores")
    required_scores = (
        "overall", "communication", "needsAnalysis", "proposalQuality", "flexibility",
        "trustBuilding", "objectionHandling", "closingSkill", "listeningSkill",
        "productKnowledge", "customerFocus", "goalAchievement",
    )
    if not isinstance(scores, dict) or any(
        type(scores.get(key)) not in (int, float) or not 0 <= scores[key] <= 100
        for key in required_scores
    ):
        raise ValueError("报告评分字段缺失或超出范围")
    for key in ("strengths", "improvements", "keyInsights"):
        if not isinstance(data.get(key), list) or any(not isinstance(v, str) for v in data[key]):
            raise ValueError("报告分析字段不完整")
    if not isinstance(data.get("nextSteps"), str) or not data["nextSteps"].strip():
        raise ValueError("报告缺少下一步建议")
    feedback = data.get("goalFeedback")
    if feedback is not None and (not isinstance(feedback, dict) or any(
        not isinstance(feedback.get(key, []), list) or any(not isinstance(v, str) for v in feedback.get(key, []))
        for key in ("achievedGoals", "partiallyAchievedGoals", "missedGoals", "recommendations")
    )):
        raise ValueError("报告目标反馈格式无效")
    return data


def _fill_report(core: dict, goal_statuses: list[dict], scenario_goals: list[dict]) -> dict:
    """目标反馈可由已保存目标状态补齐；缺失细分评分标记不可用，不伪造。"""

    # ---- goalFeedback 兜底合并 ----
    gf = core.get("goalFeedback")
    gf = gf if isinstance(gf, dict) else {}
    has_goals = bool(gf.get("achievedGoals") or gf.get("partiallyAchievedGoals") or gf.get("missedGoals"))
    has_recs = bool(gf.get("recommendations"))

    if not has_goals:
        achieved, partial, missed = [], [], []
        for i, g in enumerate(scenario_goals):
            st = goal_statuses[i] if i < len(goal_statuses) else None
            desc = g.get("description") or g.get("id") or ""
            if st and st.get("achieved"):
                achieved.append(desc)
            elif st and st.get("progress") == 50:
                partial.append(desc)
            else:
                missed.append(desc)
        gf = {
            "achievedGoals": achieved,
            "partiallyAchievedGoals": partial,
            "missedGoals": missed,
            "recommendations": gf.get("recommendations") or core.get("improvements", [])[:4],
        }
    elif not has_recs:
        gf["recommendations"] = core.get("improvements", [])[:4]
    core["goalFeedback"] = gf

    # Missing sub-scores are unavailable, never inferred from unrelated scores.
    da = core.get("detailedAnalysis")
    da = da if isinstance(da, dict) else {}
    groups = {
        "communicationPatterns": ("questionFrequency", "responseQuality", "clarityOfExplanation"),
        "customerInteraction": ("empathyLevel", "respectShown", "engagementQuality"),
        "salesTechniques": ("valuePropositionClarity", "needsAlignment", "painPointIdentification"),
    }
    valid = all(isinstance(da.get(group), dict) and all(
        type(da[group].get(key)) in (int, float) and 0 <= da[group][key] <= 100
        for key in keys
    ) for group, keys in groups.items())
    if valid:
        core["detailedAnalysis"] = da
    else:
        core.pop("detailedAnalysis", None)
        core["analysisWarnings"] = ["本次未生成完整的细分能力评分"]

    return core


def _feedback_from_business(review: dict, goal_statuses: list[dict], goals: list[dict]) -> dict:
    """Compatibility fields contain real outputs only; no synthetic legacy sub-scores."""
    coaching = review.get("coaching") or {}
    statuses = {item["goalId"]: item for item in goal_statuses}
    grouped = {"achievedGoals": [], "partiallyAchievedGoals": [], "missedGoals": []}
    for goal in goals:
        status = statuses.get(goal["id"], {})
        key = ("achievedGoals" if status.get("achieved") else
               "partiallyAchievedGoals" if status.get("progress") == 50 else "missedGoals")
        grouped[key].append(goal.get("description") or goal["id"])
    return {"scores": {"overall": review.get("totalScore")},
            "strengths": [coaching["keep"]] if coaching.get("keep") else [],
            "improvements": [coaching["fix"]] if coaching.get("fix") else [],
            "keyInsights": [], "nextSteps": coaching.get("nextPractice") or "请先核对未完成评估的项目。",
            "goalFeedback": {**grouped, "recommendations": [coaching["nextPractice"]] if coaching.get("nextPractice") else []}}


def _practice_comparison(focus: dict, current: dict, snapshot: dict, previous_report: dict | None) -> dict | None:
    if not focus.get("sourceSessionId"):
        return None
    criterion_id = focus.get("criterionId")
    previous = (previous_report or {}).get("businessReview") or {}
    old_item = next((i for i in previous.get("criteria", []) if i.get("id") == criterion_id), {})
    new_item = next((i for i in current.get("criteria", []) if i.get("id") == criterion_id), {})
    compatible = bool(previous_report and previous_report.get("rubricSnapshot") == snapshot
                      and previous.get("rubricVersion") == current.get("rubricVersion"))
    comparable = compatible and all(i.get("status") == "assessed" and type(i.get("score")) is int
                                    for i in (old_item, new_item))
    return {"sourceSessionId": focus["sourceSessionId"], "criterionId": criterion_id,
            "previousScore": old_item.get("score") if old_item.get("status") == "assessed" else None,
            "currentScore": new_item.get("score") if new_item.get("status") == "assessed" else None,
            "delta": new_item["score"] - old_item["score"] if comparable else None,
            "comparable": comparable,
            "reason": "同一规则下的单项表现对比，不代表长期能力或成交效果。" if comparable else
                      "规则或可用证据不同，本次不计算分数变化。"}


def _generate(session_id: str) -> dict:
    """核心生成。读取会话 → reasoner → 组装完整 analysis-results 响应。"""
    with db() as conn:
        session = _load_session(conn, session_id)
        if session is None:
            raise ValueError("会话不存在")
        if session["status"] != "completed":
            raise ValueError("请先结束陪练再生成复盘")
        scenario_doc = _session_scenario(conn, session)
        messages = _load_messages(conn, session_id)
        imported = conn.execute("SELECT source,context FROM review_imports WHERE session_id=?", (session_id,)).fetchone()
        state_row = conn.execute("SELECT state_json FROM session_states WHERE session_id=?", (session_id,)).fetchone()
        state_data = json.loads(state_row["state_json"]) if state_row else {}
        if imported:
            scenario_doc = {"title": session["title"], "description": imported["context"]}
        rubric_snapshot = state_data.get("rubricSnapshot") or build_rubric_snapshot(scenario_doc)
        if not state_data.get("rubricSnapshot"):
            # Freeze once for legacy sessions too. Subsequent retries use the same version.
            from ..harness.state import PracticeState, load_state, save_state
            if imported:
                state = PracticeState(sessionId=session_id, userId=session["user_id"],
                    scenarioId=session["scenario_id"], scenario=scenario_doc,
                    stage="completed", terminationReason="legacy_completed")
            else:
                state = load_state(conn, session)
            state.rubricSnapshot = rubric_snapshot
            save_state(conn, state)
        practice_focus = state_data.get("practiceFocus") or {}
        previous_report = None
        if practice_focus.get("sourceSessionId"):
            previous = conn.execute(
                "SELECT a.report_json FROM analysis_reports a JOIN sessions s ON s.id=a.session_id "
                "WHERE a.session_id=? AND s.user_id=? AND a.status='completed'",
                (practice_focus["sourceSessionId"], session["user_id"])).fetchone()
            if previous and previous["report_json"]:
                previous_report = json.loads(previous["report_json"])
        goal_statuses, scenario_goals, goal_score = _final_goal_statuses(
            conn, session_id, scenario_doc
        )

    if imported:
        from .imported_review import generate_imported_review
        return generate_imported_review(imported, messages, rubric_snapshot=rubric_snapshot)

    if not any(m["role"] == "user" and m["content"].strip() for m in messages):
        raise ValueError("没有可复盘的学员发言")
    npc = scenario_doc.get("npc") or {}
    # The opening is rendered by the client but is not stored as a messages row.
    # Keep its authoritative scenario text and stable ID in both evidence and UI.
    if isinstance(scenario_doc.get("initialMessage"), str) and scenario_doc["initialMessage"].strip():
        messages = [{"id": f"opening:{session_id}", "role": "npc",
                     "content": scenario_doc["initialMessage"], "metrics": None,
                     "meta": None, "created_at": session["created_at"]}, *messages]
    business_review = evaluate_business_review(
        scenario_doc, messages, rubric_snapshot=rubric_snapshot)
    core = _feedback_from_business(business_review, goal_statuses, scenario_goals)
    comparison = _practice_comparison(practice_focus, business_review, rubric_snapshot, previous_report)

    # ---- 组装完整响应 ----
    # realtimeMetrics：每轮 NPC 消息一个时间点（字符串数值，对齐前端 RawMetricsInfo）
    last_user = ""
    realtime_metrics = []
    for i, m in enumerate(messages):
        if m["role"] == "user":
            last_user = m["content"]
        elif m["role"] == "npc" and m["metrics"]:
            mt = m["metrics"]
            realtime_metrics.append({
                "sessionId": session_id,
                "messageNumber": str(i + 1),
                "dataType": "realtime-metric",
                "userMessage": last_user,
                "analysis": "",
                "goalScore": "0",
                "goalStatuses": [],
                "createdAt": m["created_at"],
                "angerLevel": str(mt.get("angerLevel", 1)),
                "trustLevel": str(mt.get("trustLevel", 1)),
                "progressLevel": str(mt.get("progressLevel", 1)),
            })

    final_metrics = realtime_metrics[-1] if realtime_metrics else {
        "angerLevel": "1", "trustLevel": "1", "progressLevel": "1", "analysis": ""
    }

    # sessionInfo
    npc_info = {}
    if session["npc_info"]:
        try:
            npc_info = json.loads(session["npc_info"])
        except json.JSONDecodeError:
            npc_info = {}
    session_info = {
        "sessionId": session_id,
        "userId": session["user_id"],
        "scenarioId": session["scenario_id"],
        "scenarioName": scenario_doc.get("title") or scenario_doc.get("name") or "",
        "title": session["title"],
        "status": session["status"],
        "createdAt": session["created_at"],
        "startTime": session["created_at"],
        "endTime": session["updated_at"],
        "npcInfo": {
            "name": npc.get("name", npc_info.get("name", "")),
            "role": npc.get("role", npc_info.get("role", "")),
            "company": npc.get("company", npc_info.get("company", "")),
            "personality": npc.get("personality", npc_info.get("personality", [])),
        },
    }

    # messages（前端期望 messageId / sender / content / timestamp）
    out_messages = [{
        "messageId": m["id"],
        "sender": m["role"],
        "content": m["content"],
        "timestamp": m["created_at"],
    } for m in messages]

    response: dict[str, Any] = {
        "success": True,
        "sessionId": session_id,
        "sessionInfo": session_info,
        "messages": out_messages,
        "realtimeMetrics": realtime_metrics,
        "complianceViolations": [],
        "videoAnalysis": None,
        "videoUrl": None,
        "createdAt": _now(),
        "feedback": core,
        "businessReview": business_review,
        "rubricSnapshot": rubric_snapshot,
        "practiceComparison": comparison,
        "finalMetrics": {
            "angerLevel": final_metrics["angerLevel"],
            "trustLevel": final_metrics["trustLevel"],
            "progressLevel": final_metrics["progressLevel"],
            "analysis": final_metrics.get("analysis", ""),
        },
        "feedbackCreatedAt": _now(),
        "goalResults": {
            "scenarioGoals": scenario_goals,
            "goalStatuses": goal_statuses,
            "goalScore": goal_score,
        },
        "referenceCheck": None,
        "referenceCheckCreatedAt": None,
    }
    return response


# ============================================================
# 对外入口
# ============================================================

def get_or_generate(session_id: str) -> dict:
    """优先返回已完成缓存；否则触发异步生成并返回处理中骨架（不阻塞）。"""
    cached = get_cached_report(session_id)
    if cached is not None:
        return cached
    status = trigger_async(session_id)
    result = build_processing_skeleton(session_id)
    if status == "failed":
        result.update(success=False, status="failed", error="复盘生成失败，请手动重试")
    return result
