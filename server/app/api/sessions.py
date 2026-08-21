"""会话 API：列表 / 详情 / 创建 / 消息历史。

契约与原 AWS Lambda（cdk/lambda/sessions/session_handlers.py, message_handlers.py）一致。
对话链路（NPC 回复 / 实时评分）在阶段 2 接入，消息表结构已就绪。
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..auth.jwt import UserInfo, get_current_user
from ..database import db
from ..models import CreateSessionRequest, CreateSessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_sessions(
    limit: int = 20,
    scenarioId: str | None = None,
    user: UserInfo = Depends(get_current_user),
):
    limit = 20 if limit < 1 or limit > 100 else limit
    with db() as conn:
        if scenarioId:
            rows = conn.execute(
                "SELECT * FROM sessions WHERE user_id = ? AND scenario_id = ? "
                "ORDER BY updated_at DESC LIMIT ?",
                (user.user_id, scenarioId, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
                (user.user_id, limit),
            ).fetchall()

    sessions = []
    for row in rows:
        item = {
            "sessionId": row["id"],
            "userId": row["user_id"],
            "scenarioId": row["scenario_id"],
            "title": row["title"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "status": row["status"],
        }
        if row["npc_info"]:
            item["npcInfo"] = json.loads(row["npc_info"])
        sessions.append(item)

    return {"sessions": sessions, "nextToken": None}


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
            "content": row["content"],
            "createdAt": row["created_at"],
        }
        if row["metrics"]:
            item["metrics"] = json.loads(row["metrics"])
        if row["suggestions"]:
            item["suggestions"] = json.loads(row["suggestions"])
        messages.append(item)

    return {"messages": messages, "nextToken": None}
