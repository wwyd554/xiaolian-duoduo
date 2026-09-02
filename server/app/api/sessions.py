"""会话 API：列表 / 详情 / 创建 / 消息历史 / 发送消息（对话轮）。

契约与原 AWS Lambda（cdk/lambda/sessions/session_handlers.py, message_handlers.py）一致。
对话链路（NPC 回复 + 实时评分并行）在 server/app/services/conversation.py。
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..auth.jwt import UserInfo, get_current_user
from ..database import db
from ..models import (
    CompleteSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    SendMessageRequest,
)
from ..services import report
from ..services.conversation import run_conversation_turn

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_object(value: str | None) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _duration_seconds(created_at: str, updated_at: str) -> int:
    try:
        start = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        return max(0, int((end - start).total_seconds()))
    except (TypeError, ValueError):
        return 0


def _serialize_session(row) -> dict:
    item = {
        "sessionId": row["id"],
        "userId": row["user_id"],
        "scenarioId": row["scenario_id"],
        "title": row["title"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "startTime": row["created_at"],
        "status": row["status"],
        "messageCount": row["message_count"],
        "duration": _duration_seconds(row["created_at"], row["updated_at"]),
    }
    if row["status"] == "completed":
        item["endTime"] = row["updated_at"]

    npc_info = _json_object(row["npc_info"])
    if npc_info:
        item["npcInfo"] = npc_info

    scenario = _json_object(row["scenario_data"])
    scenario_name = scenario.get("title") or scenario.get("name")
    if scenario_name:
        item["scenarioName"] = scenario_name

    latest_metrics = _json_object(row["latest_metrics"])
    if latest_metrics:
        item["metrics"] = latest_metrics

    report_data = _json_object(row["report_json"])
    scores = report_data.get("feedback", {}).get("scores", {})
    if isinstance(scores, dict) and scores:
        item["scores"] = {
            "overall": scores.get("overall", 0),
            "communication": scores.get("communication", 0),
            "trustBuilding": scores.get("trustBuilding", 0),
        }

    return item


@router.get("")
def list_sessions(
    limit: int = 20,
    nextToken: str | None = None,
    scenarioId: str | None = None,
    user: UserInfo = Depends(get_current_user),
):
    limit = 20 if limit < 1 or limit > 100 else limit
    try:
        offset = max(0, int(nextToken or "0"))
    except ValueError as exc:
        raise HTTPException(400, "无效的分页令牌") from exc

    # 复盘列表默认排除尚未产生任何对话的 active 会话。它们通常来自用户
    # 进入预览后直接退出，保留数据库记录但不让其污染可复盘历史。
    where = (
        "WHERE s.user_id = ? "
        "AND (s.status = 'completed' OR EXISTS ("
        "SELECT 1 FROM messages visible_m WHERE visible_m.session_id = s.id"
        "))"
    )
    params: list[object] = [user.user_id]
    if scenarioId:
        where += " AND s.scenario_id = ?"
        params.append(scenarioId)

    with db() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) AS count FROM sessions s {where}", params
        ).fetchone()["count"]
        rows = conn.execute(
            "SELECT s.*, "
            "(SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count, "
            "(SELECT m.metrics FROM messages m WHERE m.session_id = s.id "
            " AND m.role = 'npc' AND m.metrics IS NOT NULL "
            " ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS latest_metrics, "
            "(SELECT ar.report_json FROM analysis_reports ar WHERE ar.session_id = s.id "
            " AND ar.status = 'completed' LIMIT 1) AS report_json, "
            "(SELECT sc.data FROM scenarios sc WHERE sc.id = s.scenario_id LIMIT 1) AS scenario_data "
            f"FROM sessions s {where} ORDER BY s.updated_at DESC, s.id DESC LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()

    next_token = str(offset + limit) if offset + len(rows) < total else None
    return {
        "sessions": [_serialize_session(row) for row in rows],
        "nextToken": next_token,
        "totalCount": total,
    }


@router.get("/{session_id}")
def get_session(session_id: str, user: UserInfo = Depends(get_current_user)):
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?", (session_id, user.user_id)
        ).fetchone()
    if row is None:
        raise HTTPException(404, f"会话不存在: {session_id}")

    item = {
        "sessionId": row["id"],
        "userId": row["user_id"],
        "scenarioId": row["scenario_id"],
        "title": row["title"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }
    if row["npc_info"]:
        item["npcInfo"] = json.loads(row["npc_info"])

    # 消息数
    with db() as conn:
        item["messageCount"] = conn.execute(
            "SELECT COUNT(*) AS c FROM messages WHERE session_id = ?", (session_id,)
        ).fetchone()["c"]
    return item


@router.post("", response_model=CreateSessionResponse)
def create_session(body: CreateSessionRequest, user: UserInfo = Depends(get_current_user)):
    """创建会话（前端已传入 sessionId 则复用 / 更新）。"""
    if not body.scenarioId:
        raise HTTPException(400, "scenarioId 为必填")

    session_id = body.sessionId or str(uuid.uuid4())
    now = _now()

    with db() as conn:
        existing = conn.execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?", (session_id, user.user_id)
        ).fetchone()

        if existing:
            npc_info = json.dumps(body.npcInfo, ensure_ascii=False) if body.npcInfo else existing["npc_info"]
            title = body.title or existing["title"]
            conn.execute(
                "UPDATE sessions SET title = ?, npc_info = ?, updated_at = ? WHERE id = ?",
                (title, npc_info, now, session_id),
            )
            return CreateSessionResponse(success=True, sessionId=session_id, message="会话已更新", isNew=False)

        title = body.title
        if not title and body.npcInfo:
            title = f"{body.npcInfo.get('name', 'NPC')}的对话"
        title = title or "新对话会话"
        conn.execute(
            "INSERT INTO sessions (id, user_id, scenario_id, title, status, npc_info, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
            (
                session_id, user.user_id, body.scenarioId, title,
                json.dumps(body.npcInfo, ensure_ascii=False) if body.npcInfo else None,
                now, now,
            ),
        )
        return CreateSessionResponse(success=True, sessionId=session_id, message="会话已创建", isNew=True)


@router.post("/{session_id}/complete", response_model=CompleteSessionResponse)
def complete_session(
    session_id: str,
    user: UserInfo = Depends(get_current_user),
):
    """完成一场陪练并启动复盘报告生成（幂等）。"""
    now = _now()
    with db() as conn:
        session = conn.execute(
            "SELECT id, status FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, user.user_id),
        ).fetchone()
        if session is None:
            raise HTTPException(404, f"会话不存在: {session_id}")

        conn.execute(
            "UPDATE sessions SET status = 'completed', updated_at = ? WHERE id = ?",
            (now, session_id),
        )

    report.trigger_async(session_id)
    return CompleteSessionResponse(
        success=True,
        sessionId=session_id,
        status="completed",
        message="会话已完成，复盘生成中",
    )


@router.get("/{session_id}/messages")
def list_messages(session_id: str, user: UserInfo = Depends(get_current_user)):
    """会话消息历史（阶段 2 对话链路写入，现返回空列表或已有记录）。"""
    with db() as conn:
        sess = conn.execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?", (session_id, user.user_id)
        ).fetchone()
        if sess is None:
            raise HTTPException(404, f"会话不存在: {session_id}")
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,)
        ).fetchall()

    messages = []
    for row in rows:
        item = {
            "messageId": row["id"],
            "sessionId": row["session_id"],
            "role": row["role"],
            # 前端 MessageInfo 使用 sender/timestamp（兼容旧 role/createdAt）
            "sender": row["role"],
            "content": row["content"],
            "createdAt": row["created_at"],
            "timestamp": row["created_at"],
        }
        if row["metrics"]:
            item["metrics"] = json.loads(row["metrics"])
        if row["suggestions"]:
            item["suggestions"] = json.loads(row["suggestions"])
        messages.append(item)

    return {"messages": messages, "nextToken": None}


@router.post("/{session_id}/messages")
def send_message(
    session_id: str,
    body: SendMessageRequest,
    user: UserInfo = Depends(get_current_user),
):
    """发送消息 → NPC 回复 + 实时评分（每轮 2 次并行 LLM 调用）。

    轮次上限 = min(场景 maxTurns, 20)，达到后返回 sessionCompleted=true
    （后续请求将直接返回完成状态，不再调用模型）。
    """
    if not body.content or not body.content.strip():
        raise HTTPException(400, "消息内容不能为空")

    with db() as conn:
        sess = conn.execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?", (session_id, user.user_id)
        ).fetchone()
        if sess is None:
            raise HTTPException(404, f"会话不存在: {session_id}")

        try:
            result = run_conversation_turn(conn, sess, body, user.user_id)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        except Exception as exc:
            conn.rollback()
            raise HTTPException(500, f"对话处理失败: {exc}")

    return result
