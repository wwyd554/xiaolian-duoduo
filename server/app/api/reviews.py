"""Unified practice and imported conversation review entry points."""
import json
from datetime import datetime, timezone, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from ..auth.jwt import UserInfo, get_current_user
from ..database import db
from ..workers.jobs import enqueue_review
from ..harness.state import PracticeState, save_state
from ..services.business_review import build_rubric_snapshot

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ImportMessage(BaseModel):
    role: Literal["user", "npc"]
    content: str = Field(min_length=1, max_length=4000)


class ImportReview(BaseModel):
    id: UUID
    source: Literal["chat", "audio"] = "chat"
    title: str = Field(min_length=1, max_length=120)
    context: str = Field(min_length=1, max_length=3000)
    messages: list[ImportMessage] = Field(min_length=2, max_length=200)

    @model_validator(mode="after")
    def validate_transcript(self):
        if not self.title.strip() or not self.context.strip():
            raise ValueError("请填写标题和沟通背景")
        if any(not m.content.strip() for m in self.messages):
            raise ValueError("消息内容不能为空")
        if {m.role for m in self.messages} != {"user", "npc"}:
            raise ValueError("请确认销售和客户双方的发言")
        if sum(len(m.content) for m in self.messages) > 30000:
            raise ValueError("一次最多导入 30000 字，请分段复盘")
        return self


@router.post("/import")
def import_review(body: ImportReview, user: UserInfo = Depends(get_current_user)):
    session_id = str(body.id)
    now = datetime.now(timezone.utc)
    with db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        existing = conn.execute("SELECT user_id,title FROM sessions WHERE id=?", (session_id,)).fetchone()
        if existing:
            imported = conn.execute("SELECT source,context FROM review_imports WHERE session_id=?", (session_id,)).fetchone()
            if existing["user_id"] != user.user_id or not imported:
                raise HTTPException(409, "记录标识已使用，请重新导入")
            saved = conn.execute("SELECT role,content FROM messages WHERE session_id=? ORDER BY created_at,id", (session_id,)).fetchall()
            if (existing["title"] != body.title.strip() or imported["source"] != body.source
                    or imported["context"] != body.context.strip()
                    or [dict(m) for m in saved] != [{"role": m.role, "content": m.content.strip()} for m in body.messages]):
                raise HTTPException(409, "记录已保存且内容不同，请关闭窗口后重新导入")
            return {"sessionId": session_id}
        conn.execute(
            "INSERT INTO sessions (id,user_id,scenario_id,title,status,npc_info,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
            (session_id, user.user_id, "__import__", body.title.strip(), "completed",
             json.dumps({"name": "客户"}, ensure_ascii=False), now.isoformat(), now.isoformat()),
        )
        conn.execute("INSERT INTO review_imports VALUES (?,?,?)", (session_id, body.source, body.context.strip()))
        for index, message in enumerate(body.messages):
            conn.execute(
                "INSERT INTO messages (id,session_id,role,content,created_at) VALUES (?,?,?,?,?)",
                (f"{session_id}-{index}", session_id, message.role, message.content.strip(),
                 (now + timedelta(microseconds=index)).isoformat()),
            )
        scenario = {"title": body.title.strip(), "description": body.context.strip()}
        state = PracticeState(sessionId=session_id, userId=user.user_id, scenarioId="__import__",
                              scenario=scenario, stage="completed", terminationReason="legacy_completed")
        state.rubricSnapshot = build_rubric_snapshot(scenario)
        save_state(conn, state)
        enqueue_review(conn, session_id)
    return {"sessionId": session_id}


@router.get("")
def list_reviews(source: Literal["all", "practice", "chat", "audio"] = "all",
                 page: int = 1, user: UserInfo = Depends(get_current_user),
                 state: Literal["all", "completed", "active"] = "all"):
    page = max(1, page)
    where = "s.user_id=? AND (s.status='completed' OR EXISTS(SELECT 1 FROM messages m WHERE m.session_id=s.id))"
    params = [user.user_id]
    if source != "all":
        where += " AND COALESCE(i.source,'practice')=?"
        params.append(source)
    if state == "completed":
        where += " AND s.status='completed'"
    elif state == "active":
        where += " AND s.status!='completed'"
    joins = "FROM sessions s LEFT JOIN review_imports i ON i.session_id=s.id LEFT JOIN analysis_reports a ON a.session_id=s.id LEFT JOIN scenarios sc ON sc.id=s.scenario_id"
    with db() as conn:
        total = conn.execute(f"SELECT COUNT(*) {joins} WHERE {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT s.id,s.title,s.scenario_id,s.status,s.created_at,COALESCE(i.source,'practice') source,a.status analysis_status,a.report_json,sc.data scenario_data "
            f"{joins} WHERE {where} ORDER BY s.created_at DESC,s.id DESC LIMIT 12 OFFSET ?",
            [*params, (page - 1) * 12],
        ).fetchall()
    items = []
    for row in rows:
        item = dict(row)
        def parse_object(raw):
            try:
                value = json.loads(raw or "{}")
                return value if isinstance(value, dict) else {}
            except (ValueError, TypeError):
                return {}
        report = parse_object(item.pop("report_json")) if item["analysis_status"] == "completed" else {}
        item.pop("report_json", None)
        scenario = parse_object(item.pop("scenario_data"))
        feedback = report.get("feedback") or {}
        if not isinstance(feedback, dict):
            feedback = {}
        scores = feedback.get("scores") or {}
        business = report.get("businessReview")
        score = business.get("totalScore") if isinstance(business, dict) else (scores.get("overall") if isinstance(scores, dict) else None)
        item["rubric_version"] = business.get("rubricVersion") if isinstance(business, dict) else None
        item["business_review_status"] = business.get("status") if isinstance(business, dict) else None
        item["overall_score"] = score if isinstance(score, (int, float)) and not isinstance(score, bool) and 0 <= score <= 100 else None
        improvements = feedback.get("improvements") or []
        coaching_fix = (business.get("coaching") or {}).get("fix") if isinstance(business, dict) else None
        item["key_finding"] = coaching_fix or (improvements[0] if isinstance(improvements, list) and improvements and isinstance(improvements[0], str) else report.get("summary")) or None
        item["scenario_title"] = scenario.get("title") or scenario.get("name")
        items.append(item)
    return {"items": items, "total": total}


@router.get("/{session_id}")
def get_imported_review(session_id: str, user: UserInfo = Depends(get_current_user)):
    with db() as conn:
        row = conn.execute(
            "SELECT s.title,i.source,i.context,a.status,a.report_json FROM sessions s "
            "JOIN review_imports i ON i.session_id=s.id LEFT JOIN analysis_reports a ON a.session_id=s.id "
            "WHERE s.id=? AND s.user_id=?", (session_id, user.user_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "复盘记录不存在")
        messages = conn.execute("SELECT id AS messageId,role,content FROM messages WHERE session_id=? ORDER BY created_at,id", (session_id,)).fetchall()
    return {"title": row["title"], "source": row["source"], "context": row["context"],
            "status": row["status"] or "pending",
            "report": json.loads(row["report_json"]) if row["status"] == "completed" and row["report_json"] else None,
            "messages": [dict(m) for m in messages]}


@router.delete("/{session_id}")
def delete_review(session_id: str, user: UserInfo = Depends(get_current_user)):
    """Delete one owned review and its conversation; invalidate outstanding jobs atomically."""
    with db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT id FROM sessions WHERE id=? AND user_id=?", (session_id, user.user_id)
        ).fetchone()
        if not row:
            raise HTTPException(404, "复盘记录不存在或已删除")
        # Removing the lease prevents a running worker from publishing a late result.
        conn.execute("DELETE FROM jobs WHERE type='review' AND resource_id=?", (session_id,))
        for table in ("analysis_reports", "review_imports", "session_states", "messages", "tool_audits"):
            conn.execute(f"DELETE FROM {table} WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE id=? AND user_id=?", (session_id, user.user_id))
    return {"success": True, "sessionId": session_id}
