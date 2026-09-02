"""SQLite 数据层：连接管理 + 建表（users / invite_codes / scenarios / sessions / messages / reports）。

- WAL 模式：读写并发友好
- 每请求独立连接（FastAPI 多线程安全）
"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager

from .config import settings

_local = threading.local()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  nickname    TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT PRIMARY KEY,
  used_by    TEXT,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenarios (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,          -- 完整 scenario JSON（保留嵌套结构）
  created_by TEXT,
  is_custom  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  npc_info    TEXT,                  -- JSON
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL,         -- user / npc / system
  content     TEXT NOT NULL,
  metrics     TEXT,                  -- JSON: angerLevel/trustLevel/progressLevel
  suggestions TEXT,                  -- JSON: 建议回复
  meta        TEXT,                  -- JSON: goalUpdates/npcEmotion/gesture（评分侧会话状态持久化）
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_reports (
  session_id  TEXT PRIMARY KEY,
  status      TEXT NOT NULL,        -- pending / processing / completed / failed
  report_json TEXT,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);
"""


def _connect() -> sqlite3.Connection:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.database_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def get_conn() -> sqlite3.Connection:
    """线程绑定的连接（FastAPI 每个请求线程一个）。"""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = _connect()
        _local.conn = conn
    return conn


@contextmanager
def db():
    """事务上下文：提交/回滚 + 异常安全。"""
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def _migrate(conn: sqlite3.Connection) -> None:
    """轻量迁移：已存在的库补新增列（幂等）。"""
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(messages)")}
    if "meta" not in cols:
        conn.execute("ALTER TABLE messages ADD COLUMN meta TEXT")

    # 旧版本在手动结束陪练时只生成报告，没有同步更新 sessions.status。
    # 已有完整报告可以证明该场会话已经结束，因此在启动时安全回填状态。
    conn.execute(
        "UPDATE sessions SET status = 'completed' "
        "WHERE status = 'active' AND id IN ("
        "SELECT session_id FROM analysis_reports WHERE status = 'completed'"
        ")"
    )


def init_db() -> None:
    """建表（幂等）+ 迁移。"""
    with db() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
