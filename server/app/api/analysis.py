"""复盘报告相关端点：analysis-status / analysis-results / feedback。

前端 ResultPage 调用链：
  GET /sessions/{id}/analysis-status   -> { status }
  GET /sessions/{id}/analysis-results  -> 完整 SessionCompleteDataResponse
  GET /sessions/{id}/feedback          -> { feedback, finalMetrics, goalResults, ... }
报告按 session_id 缓存；首次访问入队，由持久任务 Worker 生成。
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
            "SELECT user_id,status FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    if row["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="无权访问该会话")
    if row["status"] != "completed":
        raise HTTPException(status_code=409, detail="请先结束陪练再生成复盘")


@router.get("/{session_id}/analysis-status")
def analysis_status(
    session_id: str,
    user: UserInfo = Depends(get_current_user),
):
    _assert_owner(session_id, user)
    return {"status": report.get_analysis_status(session_id)}


@router.post("/{session_id}/analysis-retry")
def retry_analysis(
    session_id: str,
    user: UserInfo = Depends(get_current_user),
):
    """重新生成失败的复盘报告；对生成中或已完成报告保持幂等。"""
    _assert_owner(session_id, user)
    status = report.trigger_async(session_id, retry=True)
    return {
        "success": True,
        "sessionId": session_id,
        "status": status,
        "message": "复盘报告已完成" if status == "completed" else "复盘报告已加入生成队列",
    }


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
        "success": data.get("success", True),
        "sessionId": session_id,
        "feedback": data.get("feedback"),
        "businessReview": data.get("businessReview"),
        "practiceComparison": data.get("practiceComparison"),
        "status": data.get("status", "completed"),
        "createdAt": data.get("feedbackCreatedAt"),
        "finalMetrics": data.get("finalMetrics"),
        "messageCount": len(data.get("messages", [])),
        "goalResults": data.get("goalResults"),
    }
