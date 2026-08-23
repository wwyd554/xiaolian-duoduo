"""复盘报告生成 —— LLM（llm_reasoner_model，默认 deepseek-v4-flash）分析 + 数据聚合（目标状态/情绪趋势）。

端点契约（前端 ResultPage）：先查 analysis-status，再调 analysis-results。
报告按 session_id 持久化（analysis_reports 表），避免重复消耗模型额度。
开发期采用同步生成：analysis-results / feedback 端点首次命中即现场生成并缓存。
"""
from __future__ import annotations

import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from ..database import db
from ..agents.llm import call_model
from ..agents.prompts import REPORT_SYSTEM_PROMPT, build_report_prompt
from ..agents.scoring import _extract_json
from ..config import settings

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
    if status in ("pending", "processing"):
        trigger_async(session_id)
        return "processing"
    return status


def trigger_async(session_id: str) -> None:
    """后台异步生成报告（不阻塞请求线程）。幂等：已在生成中则跳过。"""
    with db() as conn:
        row = conn.execute(
            "SELECT status FROM analysis_reports WHERE session_id = ?", (session_id,)
        ).fetchone()
        if row and row["status"] in ("pending", "processing"):
            return
    _upsert_status(session_id, "pending")
    threading.Thread(target=_run_generate, args=(session_id,), daemon=True).start()


def _run_generate(session_id: str) -> None:
    try:
        _upsert_status(session_id, "processing")
        report = _generate(session_id)
        _upsert_status(session_id, "completed", json.dumps(report, ensure_ascii=False))
    except Exception as exc:  # noqa: BLE001
        logger.error("[report] 异步生成失败 session=%s: %s", session_id, exc)
        _upsert_status(session_id, "failed", error=str(exc))


def build_processing_skeleton(session_id: str) -> dict:
    """生成中/未生成时返回的最小骨架，避免前端崩溃并提示轮询。"""
    with db() as conn:
        sess = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        scenario_doc = _load_scenario_doc(conn, sess["scenario_id"]) if sess else {}
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
                return json.loads(row["report_json"])
            except json.JSONDecodeError:
                return None
    return None


def _upsert_status(session_id: str, status: str, report_json: str | None = None,
                   error: str | None = None) -> None:
    now = _now()
    with db() as conn:
        exists = conn.execute(
            "SELECT 1 FROM analysis_reports WHERE session_id = ?", (session_id,)
        ).fetchone()
        if exists:
            conn.execute(
                "UPDATE analysis_reports SET status=?, report_json=?, error=?, updated_at=? "
                "WHERE session_id=?",
                (status, report_json, error, now, session_id),
            )
        else:
            conn.execute(
                "INSERT INTO analysis_reports (session_id, status, report_json, error, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (session_id, status, report_json, error, now, now),
            )


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


def _load_messages(conn, session_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, role, content, metrics, meta, created_at FROM messages "
        "WHERE session_id = ? ORDER BY created_at ASC",
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
            "achieved": is_achieved,
            "achievedAt": None,
            "progress": progress,
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
    return data


def _fill_report(core: dict, goal_statuses: list[dict], scenario_goals: list[dict]) -> dict:
    """补全 reasoner 可能遗漏/留空的字段（goalFeedback / detailedAnalysis），保证结构完整。

    策略：reasoner 给了真实内容则保留；若整块缺失或实质为空（空列表/空 dict），
    则用 goalResults / scores 推导，避免前端拿到空壳。
    """
    sc = core.get("scores", {})

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

    # ---- detailedAnalysis 兜底合并 ----
    da = core.get("detailedAnalysis")
    da = da if isinstance(da, dict) else {}
    defaults = {
        "communicationPatterns": {
            "questionFrequency": sc.get("listeningSkill", 60),
            "responseQuality": sc.get("communication", 60),
            "clarityOfExplanation": sc.get("proposalQuality", 60),
        },
        "customerInteraction": {
            "empathyLevel": sc.get("customerFocus", 60),
            "respectShown": sc.get("communication", 60),
            "engagementQuality": sc.get("trustBuilding", 60),
        },
        "salesTechniques": {
            "valuePropositionClarity": sc.get("proposalQuality", 60),
            "needsAlignment": sc.get("needsAnalysis", 60),
            "painPointIdentification": sc.get("needsAnalysis", 60),
        },
    }
    for grp, val in defaults.items():
        if not isinstance(da.get(grp), dict):
            da[grp] = dict(val)
        else:
            for k, v in val.items():
                if not isinstance(da[grp].get(k), (int, float)):
                    da[grp][k] = v
    core["detailedAnalysis"] = da

    return core


def _default_report() -> dict:
    return {
        "scores": {
            "overall": 60, "communication": 60, "needsAnalysis": 60,
            "proposalQuality": 60, "flexibility": 60, "trustBuilding": 60,
            "objectionHandling": 60, "closingSkill": 60, "listeningSkill": 60,
            "productKnowledge": 60, "customerFocus": 60, "goalAchievement": 60,
        },
        "strengths": [],
        "improvements": ["（本次未能生成详细分析，请稍后重试或联系管理员）"],
        "keyInsights": [],
        "nextSteps": "建议重新进行一次完整陪练，以便系统生成针对性复盘。",
        "goalFeedback": {
            "achievedGoals": [], "partiallyAchievedGoals": [],
            "missedGoals": [], "recommendations": [],
        },
        "detailedAnalysis": {
            "communicationPatterns": {"questionFrequency": 60, "responseQuality": 60, "clarityOfExplanation": 60},
            "customerInteraction": {"empathyLevel": 60, "respectShown": 60, "engagementQuality": 60},
            "salesTechniques": {"valuePropositionClarity": 60, "needsAlignment": 60, "painPointIdentification": 60},
        },
    }


def _generate(session_id: str) -> dict:
    """核心生成。读取会话 → reasoner → 组装完整 analysis-results 响应。"""
    with db() as conn:
        session = _load_session(conn, session_id)
        if session is None:
            raise ValueError("会话不存在")
        scenario_doc = _load_scenario_doc(conn, session["scenario_id"])
        messages = _load_messages(conn, session_id)
        metrics_history = _metrics_history(messages)
        goal_statuses, scenario_goals, goal_score = _final_goal_statuses(
            conn, session_id, scenario_doc
        )

    transcript = _build_transcript(messages)
    npc = scenario_doc.get("npc") or {}

    # ---- reasoner 生成核心报告（不稳定时重试一次）----
    core: dict | None = None
    last_raw = ""
    for attempt in range(2):
        try:
            prompt = build_report_prompt(scenario_doc, transcript, metrics_history, goal_statuses)
            raw = call_model(
                system=REPORT_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
                model=settings.llm_reasoner_model,
                max_tokens=8192,
                label="feedback-report",
            )
            last_raw = raw
            core = _parse_report_json(raw)
            break
        except Exception as exc:  # noqa: BLE001
            logger.warning("[report] session=%s reasoner 解析失败 attempt %d: %s", session_id, attempt, exc)
    if core is None:
        logger.warning("[report] session=%s reasoner 最终失败，原始输出前300: %s", session_id, last_raw[:300])
        core = _default_report()
    else:
        core = _fill_report(core, goal_statuses, scenario_goals)
        logger.info("[report] session=%s reasoner 输出解析成功", session_id)

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
    trigger_async(session_id)
    return build_processing_skeleton(session_id)
