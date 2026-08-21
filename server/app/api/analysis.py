"""复盘报告相关端点：analysis-status / analysis-results / feedback。

前端 ResultPage 调用链：
  GET /sessions/{id}/analysis-status   -> { status }
  GET /sessions/{id}/analysis-results  -> 完整 SessionCompleteDataResponse
  GET /sessions/{id}/feedback          -> { feedback, finalMetrics, goalResults, ... }
报告按 session_id 缓存（analysis_reports 表），首次访问同步生成。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..auth.jwt import UserInfo, get_current_user
from ..database import db
from ..services import report

router = APIRouter(prefix="/sessions", tags=["analysis"])


def _assert_owner(session_id: str, user: UserInfo) -> None:
    with db() as conn:
        row = conn.execute(
            "SELECT user_id FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    if row["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="无权访问该会话")


@router.get("/{session_id}/analysis-status")
def analysis_status(
    session_id: str,
    user: UserInfo = Depends(get_current_user),
):
    _assert_owner(session_id, user)
    return {"status": report.get_analysis_status(session_id)}


@router.get("/{session_id}/analysis-results")
def analysis_results(
    session_id: str,
    user: UserInfo = Depends(get_current_user),
):
    _assert_owner(session_id, user)
    return report.get_or_generate(session_id)


@router.get("/{session_id}/feedback")
def session_feedback(
    session_id: str,
    user: UserInfo = Depends(get_current_user),
):
    _assert_owner(session_id, user)
    data = report.get_or_generate(session_id)
    return {
        "success": True,
        "sessionId": session_id,
        "feedback": data.get("feedback"),
        "createdAt": data.get("feedbackCreatedAt"),
        "finalMetrics": data.get("finalMetrics"),
        "messageCount": len(data.get("messages", [])),
        "goalResults": data.get("goalResults"),
    }
