"""对话轮核心逻辑 —— NPC 回复 + 实时评分（并行）+ 轮次上限。

对应原 AgentCore 的 npc-conversation 与 realtime-scoring 两个代理，
合并为单次请求内的两个并行 LLM 调用（每轮 2 次，均用 llm_chat_model）。
"""
from __future__ import annotations

import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from ..agents.llm import call_model
from ..agents.prompts import build_npc_system_prompt, build_scoring_prompt
from ..agents.scoring import parse_scoring_output
from ..config import settings

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
    rows = conn.execute(
        "SELECT role, content FROM messages WHERE session_id = ? "
        "AND role IN ('user','npc') ORDER BY created_at ASC LIMIT ?",
        (session_id, HISTORY_LIMIT),
    ).fetchall()
    return [{"sender": r["role"], "content": r["content"]} for r in rows]


def _run_npc_turn(npc_system_prompt: str, history: list[dict], user_message: str) -> str:
    messages = [{"role": "user", "content": m["content"]} for m in history]
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
        max_tokens=1024,
        label="realtime-scoring",
    )
    return parse_scoring_output(model_text)


def run_conversation_turn(conn, session_row, body, user_id: str) -> dict:
    """执行一轮对话。返回发给前端的响应体。"""
    session_id = session_row["id"]
    scenario_doc = _load_scenario_doc(conn, session_row["scenario_id"])
    if not scenario_doc:
        raise ValueError("场景数据不存在或已损坏")

    # ---- 轮次上限：min(场景 maxTurns, 全局 20) ----
    scenario_max = int(scenario_doc.get("maxTurns") or GLOBAL_MAX_TURNS)
    max_turns = min(scenario_max, GLOBAL_MAX_TURNS)
    turns_used = conn.execute(
        "SELECT COUNT(*) AS c FROM messages WHERE session_id = ? AND role = 'user'",
        (session_id,),
    ).fetchone()["c"]
    if turns_used >= max_turns:
        return _session_completed_response(session_id, turns_used, max_turns)

    # ---- NPC 信息：请求传入优先，否则会话 npc_info，否则场景 npc ----
    npc_info = body.npcInfo
    if npc_info is None and session_row["npc_info"]:
        try:
            npc_info = json.loads(session_row["npc_info"])
        except json.JSONDecodeError:
            npc_info = None
    if npc_info is None:
        npc_info = scenario_doc.get("npc") or {}

    # ---- 当前情绪 & 目标 ----
    current_metrics = _get_current_metrics(conn, session_id, scenario_doc)
    if body.emotionParams:
        current_metrics = {k: body.emotionParams.get(k, current_metrics[k]) for k in _EMOTION_KEYS}

    # ---- 目标状态：后端从 meta 自恢复，前端显式回传则覆盖 ----
    goals = scenario_doc.get("goals") or []
    if body.goals:
        goals = body.goals
    restored_updates = _load_last_npc_meta(conn, session_id).get("goalUpdates") or []
    if restored_updates:
        goals = _merge_goal_statuses(goals, restored_updates)
    if body.goalStatuses:
        goals = _merge_goal_statuses(goals, body.goalStatuses)

    scenario_description = body.scenarioDescription or scenario_doc.get("description") or ""
    language = body.language or "zh"

    # ---- 历史 & 提示词 ----
    history = _build_llm_history(conn, session_id)
    npc_system_prompt = build_npc_system_prompt(
        npc_info=npc_info,
        emotion_params=current_metrics,
        language=language,
    )
    user_message = body.content

    # ---- 并行调用：NPC 回复 + 实时评分 ----
    with ThreadPoolExecutor(max_workers=2) as pool:
        npc_future = pool.submit(_run_npc_turn, npc_system_prompt, history, user_message)
        scoring_future = pool.submit(
            _run_scoring,
            user_message,
            history,
            current_metrics,
            goals,
            scenario_description,
            language,
        )
        npc_response = npc_future.result()
        scoring = scoring_future.result()

    # ---- 写入消息 ----
    now = _now()
    user_msg_id = str(uuid.uuid4())
    npc_msg_id = str(uuid.uuid4())
    metrics = scoring["scores"]
    suggestions = scoring["suggestions"]
    goal_updates = scoring["goalUpdates"]

    npc_meta = json.dumps({
        "metrics": metrics,
        "goalUpdates": goal_updates,
        "npcEmotion": scoring["npcEmotion"],
        "npcEmotionIntensity": scoring["npcEmotionIntensity"],
        "gesture": scoring["gesture"],
    }, ensure_ascii=False)
    # 兜底：模型省略未变化目标导致空数组时，恢复上次持久化的目标状态（保证前端拿到完整快照）
    if not goal_updates and restored_updates:
        goal_updates = restored_updates
        logger.info("[conversation] session=%s goalUpdates 为空，已从 meta 恢复 %d 条", session_id, len(goal_updates))
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
    }
