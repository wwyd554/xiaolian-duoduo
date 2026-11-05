"""Fail-closed durable pre/post tool audit, separate from business transactions."""
import time
import uuid
import sqlite3
from contextlib import contextmanager

from ..config import settings
from .observability import current_trace, emit


@contextmanager
def audit_db(context):
    # The owning runtime supplies its real connection's database path, never model input.
    # Do not fall back to the production DB when running an isolated evaluator.
    if not context.audit_database_path:
        raise RuntimeError("持久化工具审计不可用")
    conn = sqlite3.connect(context.audit_database_path)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def pre_tool(context, tool: str, effect: str, argument_bytes: int) -> str:
    audit_id = uuid.uuid4().hex
    with audit_db(context) as conn:
        conn.execute("DELETE FROM tool_audits WHERE created_at < ?", (time.time() - settings.trace_retention_days * 86400,))
        conn.execute("INSERT INTO tool_audits(id,trace_id,session_id,user_id,tool,effect,status,argument_bytes,created_at) "
                     "VALUES (?,?,?,?,?,?,'started',?,?)",
                     (audit_id, current_trace(), context.state.sessionId, context.user_id, tool, effect,
                      argument_bytes, time.time()))
    emit("pre_tool", tool=tool, status="started")
    return audit_id


def post_tool(context, audit_id: str, tool: str, status: str, reason: str, started: float):
    elapsed = round((time.monotonic() - started) * 1000)
    with audit_db(context) as conn:
        conn.execute("UPDATE tool_audits SET status=?,reason=?,elapsed_ms=? WHERE id=?",
                     (status, reason, elapsed, audit_id))
    emit("post_tool", tool=tool, status=status, reason=reason, elapsed_ms=elapsed)
