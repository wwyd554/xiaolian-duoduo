"""SQLite shared fixed-minute quotas and expiring speech concurrency leases."""
import time
import uuid

from fastapi import HTTPException

from ..database import independent_db
from ..config import settings


def _consume(conn, user_id, scope, amount, limit):
    window = int(time.time() // 60)
    conn.execute("DELETE FROM resource_rates WHERE window < ?", (window - 2,))
    row = conn.execute("SELECT used FROM resource_rates WHERE user_id=? AND scope=? AND window=?",
                       (user_id, scope, window)).fetchone()
    if (row[0] if row else 0) + amount > limit:
        raise HTTPException(429, "请求过于频繁，请稍后重试", headers={"Retry-After": "60"})
    conn.execute("INSERT INTO resource_rates VALUES (?,?,?,?) ON CONFLICT(user_id,scope,window) "
                 "DO UPDATE SET used=used+excluded.used", (user_id, scope, window, amount))


def consume_audio(user_id: str, size: int):
    with independent_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        _consume(conn, user_id, "asr_bytes", size, 16000 * 2 * 75)


def acquire(user_id: str, scope: str) -> str:
    if scope not in {"asr", "tts"}:
        raise ValueError("unknown resource scope")
    with independent_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM resource_leases WHERE expires_at <= ?", (time.time(),))
        count = conn.execute("SELECT COUNT(*) FROM resource_leases WHERE scope=?", (scope,)).fetchone()[0]
        own = conn.execute("SELECT COUNT(*) FROM resource_leases WHERE scope=? AND user_id=?", (scope, user_id)).fetchone()[0]
        if count >= settings.speech_concurrency or own >= (1 if scope == "asr" else 2):
            raise HTTPException(429, "语音资源繁忙，请稍后重试", headers={"Retry-After": "10"})
        _consume(conn, user_id, scope, 1, settings.speech_requests_per_minute)
        lease = uuid.uuid4().hex
        conn.execute("INSERT INTO resource_leases VALUES (?,?,?,?)",
                     (lease, user_id, scope, time.time() + (1800 if scope == "asr" else 60)))
        return lease


def release(lease: str):
    with independent_db() as conn:
        conn.execute("DELETE FROM resource_leases WHERE id=?", (lease,))


def renew_asr_lease(lease: str):
    """Keep a recording worker counted while it still owns its inference resources."""
    with independent_db() as conn:
        conn.execute("UPDATE resource_leases SET expires_at=? WHERE id=? AND scope='asr'",
                     (time.time() + 1800, lease))
