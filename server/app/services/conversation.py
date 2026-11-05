"""对话轮核心逻辑 —— NPC 回复 + 实时评分（并行）+ 轮次上限。

对应原 AgentCore 的 npc-conversation 与 realtime-scoring 两个代理，
合并为单次请求内的两个并行 LLM 调用（每轮 2 次，均用 llm_chat_model）。
"""
from __future__ import annotations

import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextvars import copy_context
from datetime import datetime, timezone

from ..agents.llm import call_model
from ..agents.prompts import build_npc_system_prompt, build_scoring_prompt
from ..agents.scoring import parse_scoring_output
from ..config import settings
from ..workers.jobs import enqueue_review

logger = logging.getLogger("conversation")

# 全局硬上限（方案拍板：单场陪练不超过 20 轮用户消息）
GLOBAL_MAX_TURNS = 20
# 送入 LLM 的对话历史条数
HISTORY_LIMIT = 10

_EMOTION_KEYS = ("angerLevel", "trustLevel", "progressLevel")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_scenario_doc(conn, scenario_id: str) -> dict:
    row = conn.execute(
        "SELECT data FROM scenarios WHERE id = ?", (scenario_id,)
    ).fetchone()
    if row is None:
        return {}
    try:
        return json.loads(row["data"])
    except json.JSONDecodeError:
        logger.warning("场景 %s 数据损坏", scenario_id)
        return {}


def _merge_goal_statuses(goals: list[dict], goal_statuses: list[dict] | None) -> list[dict]:
    """把 goalStatuses（前端）或 goalUpdates（评分输出）合并进 goals（设置 achieved）。"""
    if not goal_statuses:
        return goals
    status_map = {}
    for s in goal_statuses:
        if not isinstance(s, dict):
            continue
        # goalUpdates 结构带 goalId；goalStatuses 结构带 goalId（前端转换后）
        sid = s.get("goalId") or s.get("id")
        if sid:
            status_map[sid] = s
    merged = []
    for goal in goals:
        g = dict(goal)
        status = status_map.get(goal.get("id", ""))
        if status:
            g["achieved"] = bool(status.get("achieved", False))
        merged.append(g)
    return merged


def _load_last_npc_meta(conn, session_id: str) -> dict:
    """从最后一条 NPC 消息的 meta 恢复会话状态（goalUpdates/npcEmotion/gesture）。"""
    row = conn.execute(
        "SELECT meta FROM messages WHERE session_id = ? AND role = 'npc' "
        "AND meta IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    if not row or not row["meta"]:
        return {}
    try:
        meta = json.loads(row["meta"])
        return meta if isinstance(meta, dict) else {}
    except json.JSONDecodeError:
        return {}


def _get_current_metrics(conn, session_id: str, scenario_doc: dict) -> dict:
    """当前情绪状态：最后一条 NPC 消息的 metrics，否则场景 initialMetrics / 默认。"""
    row = conn.execute(
        "SELECT metrics FROM messages WHERE session_id = ? AND role = 'npc' "
        "AND metrics IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    if row and row["metrics"]:
        try:
            metrics = json.loads(row["metrics"])
            return {k: metrics.get(k, 1) for k in _EMOTION_KEYS}
        except json.JSONDecodeError:
            pass
    initial = scenario_doc.get("initialMetrics") or {}
    return {k: initial.get(k, 1) for k in _EMOTION_KEYS}


def _build_llm_history(conn, session_id: str) -> list[dict]:
    # 先倒序取最近 N 条，再恢复为正序。直接 ASC LIMIT 会在长会话中一直
    # 把最早的消息送给模型，导致模型看不到最新上下文。
    rows = conn.execute(
        "SELECT role, content FROM ("
        "SELECT rowid, role, content, created_at FROM messages WHERE session_id = ? "
        "AND role IN ('user','npc') ORDER BY created_at DESC, rowid DESC LIMIT ?"
        ") ORDER BY created_at ASC, rowid ASC",
        (session_id, HISTORY_LIMIT),
    ).fetchall()
    return [{"sender": r["role"], "content": r["content"]} for r in rows]


def _run_npc_turn(npc_system_prompt: str, history: list[dict], user_message: str) -> str:
    # Messages API 中，销售人员是 user，NPC 客户是 assistant。此前把两者
    # 全部标成 user，会让模型把自己上一轮的回复误认为销售发言。
    messages = [
        {
            "role": "assistant" if m["sender"] == "npc" else "user",
            "content": m["content"],
        }
        for m in history
    ]
    messages.append({"role": "user", "content": user_message})
    return call_model(
        system=npc_system_prompt,
        messages=messages,
        model=settings.llm_chat_model,
        max_tokens=500,
        label="npc-conversation",
    )


def _run_scoring(
    user_message: str,
    history: list[dict],
    current_scores: dict,
    goals: list[dict],
    scenario_description: str,
    language: str,
) -> dict:
    prompt = build_scoring_prompt(
        user_message=user_message,
        previous_messages=history,
        current_scores=current_scores,
        goals=goals,
        language=language,
        scenario_description=scenario_description,
    )
    model_text = call_model(
        system="你是一个严谨的销售对话评分引擎。",
        messages=[{"role": "user", "content": prompt}],
        model=settings.llm_chat_model,
        max_tokens=2048,
        label="realtime-scoring",
    )
    return parse_scoring_output(model_text, fallback_scores=current_scores)


def run_conversation_turn(conn, session_row, body, user_id: str) -> dict:
    if settings.harness_runtime_enabled:
        from ..harness.runtime import run_turn
        return run_turn(conn, session_row, body, user_id)
    return _run_legacy_conversation_turn(conn, session_row, body, user_id)


def _run_legacy_conversation_turn(conn, session_row, body, user_id: str) -> dict:
    """执行一轮对话。返回发给前端的响应体。"""
    from ..harness.state import load_state, save_state
    authority = load_state(conn, session_row)
    session_id = session_row["id"]
    scenario_doc = authority.scenario
    if not scenario_doc:
        raise ValueError("场景数据不存在或已损坏")

    # ---- 轮次上限：min(场景 maxTurns, 全局 20) ----
    scenario_max = int(scenario_doc.get("maxTurns") or GLOBAL_MAX_TURNS)
    max_turns = min(scenario_max, GLOBAL_MAX_TURNS)
    turns_used = conn.execute(
        "SELECT COUNT(*) AS c FROM messages WHERE session_id = ? AND role = 'user'",
        (session_id,),
    ).fetchone()["c"]
    if session_row["status"] == "completed" or turns_used >= max_turns:
        return _session_completed_response(session_id, turns_used, max_turns)

    # Rollback changes orchestration, never resource ownership or authoritative state.
    npc_info = scenario_doc.get("npc") or {}

    # ---- 当前情绪 & 目标 ----
    current_metrics = authority.customerState

    # ---- 目标状态：后端从 meta 自恢复，前端显式回传则覆盖 ----
    goals = scenario_doc.get("goals") or []
    restored_updates = _load_last_npc_meta(conn, session_id).get("goalUpdates") or []
    if restored_updates:
        goals = _merge_goal_statuses(goals, restored_updates)

    scenario_description = scenario_doc.get("description") or ""
    initial_message = scenario_doc.get("initialMessage") or ""
    language = body.language or "zh"

    # ---- 历史 & 提示词 ----
    history = _build_llm_history(conn, session_id)
    npc_system_prompt = build_npc_system_prompt(
        npc_info=npc_info,
        emotion_params=current_metrics,
        language=language,
        scenario_description=scenario_description,
        initial_message=initial_message,
    )
    if authority.practiceFocus:
        from .practice_plan import focus_context
        focus = focus_context(authority.practiceFocus)
        if focus:
            npc_system_prompt += ("\n本次为针对一个能力的复练。你仍是客户，不替销售作答，不提及训练目标或上次得分。"
                                  "以原场景事实为准，不补造产品、价格或客户背景。客户回应方向："
                                  + focus["customerBehavior"])
            scenario_description += "\n本次复练重点：" + focus["label"]
    user_message = body.content
    scoring_history = history
    if initial_message:
        # 开场白目前由前端直接展示，数据库中没有这条 NPC 消息；评分模型需要
        # 看见它，才能正确理解销售人员第一轮是在回答什么。
        scoring_history = [{"sender": "npc", "content": initial_message}, *history]

    # ---- 并行调用：NPC 回复 + 实时评分 ----
    with ThreadPoolExecutor(max_workers=2) as pool:
        npc_future = pool.submit(copy_context().run, _run_npc_turn, npc_system_prompt, history, user_message)
        scoring_future = pool.submit(
            copy_context().run, _run_scoring,
            user_message,
            scoring_history,
            current_metrics,
            goals,
            scenario_description,
            language,
        )
        npc_response = npc_future.result()
        scoring = scoring_future.result()

    # A manual completion or competing turn may have committed while models ran.
    # Recheck under the write lock so a late turn never mutates an already queued review.
    conn.execute("BEGIN IMMEDIATE")
    latest = conn.execute("SELECT status FROM sessions WHERE id=?", (session_id,)).fetchone()
    if latest is None:
        raise ValueError("会话已删除，无法继续练习")
    latest_turns = conn.execute(
        "SELECT COUNT(*) FROM messages WHERE session_id=? AND role='user'", (session_id,)
    ).fetchone()[0]
    if latest["status"] == "completed":
        return _session_completed_response(session_id, latest_turns, max_turns)
    if latest_turns != turns_used:
        raise ValueError("上一条消息已更新会话，请刷新后再发送")

    # ---- 写入消息 ----
    now = _now()
    user_msg_id = str(uuid.uuid4())
    npc_msg_id = str(uuid.uuid4())
    metrics = scoring["scores"]
    suggestions = scoring["suggestions"]
    goal_updates = scoring["goalUpdates"]

    if not goal_updates and restored_updates:
        goal_updates = restored_updates
    npc_meta = json.dumps({
        "metrics": metrics,
        "goalUpdates": goal_updates,
        "npcEmotion": scoring["npcEmotion"],
        "npcEmotionIntensity": scoring["npcEmotionIntensity"],
        "gesture": scoring["gesture"],
    }, ensure_ascii=False)
    metrics_json = json.dumps(metrics, ensure_ascii=False)
    suggestions_json = json.dumps(suggestions, ensure_ascii=False)

    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, metrics, suggestions, meta, created_at) "
        "VALUES (?, ?, 'user', ?, NULL, NULL, NULL, ?)",
        (user_msg_id, session_id, user_message, now),
    )
    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, metrics, suggestions, meta, created_at) "
        "VALUES (?, ?, 'npc', ?, ?, ?, ?, ?)",
        (npc_msg_id, session_id, npc_response, metrics_json, suggestions_json, npc_meta, now),
    )

    # ---- 轮次统计 & 会话状态 ----
    turns_used += 1
    session_completed = turns_used >= max_turns
    new_status = "completed" if session_completed else session_row["status"]
    conn.execute(
        "UPDATE sessions SET updated_at = ?, status = ? WHERE id = ?",
        (now, new_status, session_id),
    )
    authority = load_state(conn, conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone())
    if session_completed:
        authority.terminationReason = "max_turns"
    save_state(conn, authority)
    if session_completed:
        enqueue_review(conn, session_id)

    logger.info(
        "[conversation] session=%s turn=%d/%d len=%d scoring=%s",
        session_id, turns_used, max_turns, len(npc_response), metrics,
    )

    return {
        "success": True,
        "response": npc_response,
        "sessionId": session_id,
        "messageId": npc_msg_id,
        "metrics": metrics,
        "analysis": scoring["analysis"],
        "goalUpdates": goal_updates,
        "suggestions": suggestions,
        "npcEmotion": scoring["npcEmotion"],
        "npcEmotionIntensity": scoring["npcEmotionIntensity"],
        "gesture": scoring["gesture"],
        "sessionCompleted": session_completed,
        "turnsUsed": turns_used,
        "maxTurns": max_turns,
        "npcMeta": json.loads(npc_meta),
        "terminationReason": authority.terminationReason,
    }


def _session_completed_response(session_id: str, turns_used: int, max_turns: int) -> dict:
    return {
        "success": False,
        "response": "",
        "sessionId": session_id,
        "messageId": "",
        "metrics": {},
        "analysis": "",
        "goalUpdates": [],
        "suggestions": [],
        "npcEmotion": "neutral",
        "npcEmotionIntensity": 0.5,
        "gesture": "none",
        "sessionCompleted": True,
        "turnsUsed": turns_used,
        "maxTurns": max_turns,
        "npcMeta": None,
        "terminationReason": "max_turns" if turns_used >= max_turns else "legacy_completed",
    }
