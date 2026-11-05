"""SQLite review queue: atomic enqueue/claim, bounded leases and fenced completion.

Generation runs outside transactions. A worker that loses its lease cannot overwrite
the result of a replacement worker. Automatic attempts are bounded; explicit retry
resets a terminal failed job, while completed reports are immutable here.
"""
from __future__ import annotations

import json
import logging
import queue
import threading
import time
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from ..config import settings
from ..database import independent_db
from ..harness.observability import current_trace, emit, trace_id

logger = logging.getLogger("jobs")


def stamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def enqueue_review(conn, session_id: str, *, retry: bool = False) -> str:
    """Caller owns transaction, allowing session completion and enqueue to commit together."""
    if not conn.execute("SELECT 1 FROM sessions WHERE id=?", (session_id,)).fetchone():
        raise HTTPException(404, "复盘记录不存在或已删除")
    row = conn.execute("SELECT status,report_json FROM analysis_reports WHERE session_id=?", (session_id,)).fetchone()
    if row and row["status"] == "completed":
        try:
            if isinstance(json.loads(row["report_json"] or "null"), dict):
                return "completed"
        except json.JSONDecodeError:
            pass
    job = conn.execute("SELECT status FROM jobs WHERE type='review' AND resource_id=?", (session_id,)).fetchone()
    if job and job["status"] in ("pending", "running"):
        return "processing"
    if job and job["status"] == "dead" and not retry:
        return "failed"
    now = stamp()
    conn.execute(
        "INSERT INTO jobs(id,type,resource_id,trace_id,status,max_attempts,next_run_at,created_at,updated_at) "
        "VALUES (?,'review',?,?,'pending',?,?,?,?) ON CONFLICT(type,resource_id) DO UPDATE SET "
        "status='pending',attempt=0,lease_token=NULL,lease_until=NULL,deadline=NULL,error=NULL,"
        "max_attempts=excluded.max_attempts,trace_id=excluded.trace_id,next_run_at=excluded.next_run_at,updated_at=excluded.updated_at",
        (uuid.uuid4().hex, session_id, current_trace(), settings.job_max_attempts, time.time(), now, now),
    )
    conn.execute(
        "INSERT INTO analysis_reports(session_id,status,created_at,updated_at) VALUES (?,'pending',?,?) "
        "ON CONFLICT(session_id) DO UPDATE SET status='pending',error=NULL,updated_at=excluded.updated_at",
        (session_id, now, now),
    )
    return "processing"


def recover_legacy() -> None:
    """Import stranded reports from the previous daemon-thread implementation."""
    with independent_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        rows = conn.execute(
            "SELECT ar.session_id FROM analysis_reports ar JOIN sessions s ON s.id=ar.session_id "
            "WHERE s.status='completed' AND ar.status IN ('pending','processing') AND NOT EXISTS "
            "(SELECT 1 FROM jobs j WHERE j.type='review' AND j.resource_id=ar.session_id)"
        ).fetchall()
        for row in rows:
            enqueue_review(conn, row["session_id"])


def claim(now: float | None = None) -> dict | None:
    now = time.time() if now is None else now
    with independent_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        # Stale leases and absolute deadlines are both enforced, even if a worker hangs.
        expired = conn.execute(
            "SELECT * FROM jobs WHERE status='running' AND (lease_until<=? OR deadline<=?)", (now, now)
        ).fetchall()
        for row in expired:
            dead = row["attempt"] >= row["max_attempts"]
            conn.execute(
                "UPDATE jobs SET status=?,lease_token=NULL,lease_until=NULL,deadline=NULL,"
                "error='WorkerLeaseExpired',next_run_at=?,updated_at=? WHERE id=?",
                ("dead" if dead else "pending", now, stamp(), row["id"]),
            )
            conn.execute("UPDATE analysis_reports SET status=?,error=?,updated_at=? WHERE session_id=?",
                         ("failed" if dead else "pending", "任务执行中断，可重试", stamp(), row["resource_id"]))
        row = conn.execute(
            "SELECT * FROM jobs WHERE status='pending' AND next_run_at<=? ORDER BY next_run_at,id LIMIT 1", (now,)
        ).fetchone()
        if not row:
            return None
        token = uuid.uuid4().hex
        conn.execute(
            "UPDATE jobs SET status='running',attempt=attempt+1,lease_token=?,lease_until=?,deadline=?,updated_at=? WHERE id=?",
            (token, now + settings.job_lease_seconds, now + settings.job_timeout_seconds, stamp(), row["id"]),
        )
        conn.execute("UPDATE analysis_reports SET status='processing',updated_at=? WHERE session_id=?",
                     (stamp(), row["resource_id"]))
        return dict(conn.execute("SELECT * FROM jobs WHERE id=?", (row["id"],)).fetchone())


def heartbeat(job: dict) -> bool:
    now = time.time()
    with independent_db() as conn:
        changed = conn.execute(
            "UPDATE jobs SET lease_until=?,updated_at=? WHERE id=? AND status='running' "
            "AND lease_token=? AND lease_until>? AND deadline>?",
            (now + settings.job_lease_seconds, stamp(), job["id"], job["lease_token"], now, now),
        ).rowcount
        return changed == 1


def finish(job: dict, result: dict | None = None, error: Exception | None = None) -> bool:
    if error is None and (not isinstance(result, dict) or not result):
        error = ValueError("EmptyReport")
    now = time.time()
    with independent_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM jobs WHERE id=? AND status='running' AND lease_token=? AND lease_until>? AND deadline>?",
            (job["id"], job["lease_token"], now, now),
        ).fetchone()
        if not row:
            return False
        status = "completed" if error is None else ("dead" if row["attempt"] >= row["max_attempts"] else "pending")
        conn.execute(
            "UPDATE jobs SET status=?,lease_token=NULL,lease_until=NULL,deadline=NULL,error=?,next_run_at=?,updated_at=? WHERE id=?",
            (status, type(error).__name__ if error else None, now + min(60, 2 ** row["attempt"]), stamp(), job["id"]),
        )
        conn.execute(
            "UPDATE analysis_reports SET status=?,report_json=?,error=?,updated_at=? WHERE session_id=?",
            ("failed" if status == "dead" else status, json.dumps(result, ensure_ascii=False) if result is not None else None,
             "复盘生成失败，请稍后重试" if error else None, stamp(), row["resource_id"]),
        )
    return True


class ReviewWorker:
    def __init__(self):
        self.stop_event = threading.Event()
        self.thread: threading.Thread | None = None

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        recover_legacy()
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._loop, name="review-worker", daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2)

    def _loop(self):
        while not self.stop_event.is_set():
            try:
                job = claim()
                if job:
                    self.run(job)
                    continue
            except Exception as exc:
                logger.error("worker_iteration_failed error_type=%s", type(exc).__name__)
            self.stop_event.wait(settings.job_poll_seconds)

    def run(self, job: dict):
        from ..services.report import _generate
        token = trace_id.set(job["trace_id"])
        outcome = queue.Queue(maxsize=1)

        def generate():
            child_token = trace_id.set(job["trace_id"])
            try:
                outcome.put((_generate(job["resource_id"]), None))
            except Exception as exc:
                outcome.put((None, exc))
            finally:
                trace_id.reset(child_token)

        thread = threading.Thread(target=generate, name="review-generation", daemon=True)
        thread.start()
        emit("job_started", job_id=job["id"], attempt=job["attempt"])
        try:
            next_heartbeat = time.monotonic() + settings.job_lease_seconds / 3
            while not self.stop_event.is_set() and time.time() < job["deadline"]:
                try:
                    result, error = outcome.get(timeout=0.25)
                except queue.Empty:
                    if time.monotonic() >= next_heartbeat:
                        if not heartbeat(job):
                            break
                        next_heartbeat = time.monotonic() + settings.job_lease_seconds / 3
                    continue
                saved = finish(job, result=result, error=error)
                emit("job_finished", job_id=job["id"],
                     status=("failed" if error else "completed") if saved else "lease_lost",
                     error_type=type(error).__name__ if error else None)
                return
            # The generation thread cannot publish; only this lease holder can.
            # On shutdown we let the lease expire rather than stealing other workers' jobs.
            emit("job_interrupted", job_id=job["id"], status="lease_lost")
        finally:
            trace_id.reset(token)


if __name__ == "__main__":
    import signal
    from ..database import init_db
    settings.validate()
    init_db()
    worker = ReviewWorker()
    signal.signal(signal.SIGTERM, lambda *_: worker.stop_event.set())
    signal.signal(signal.SIGINT, lambda *_: worker.stop_event.set())
    worker.start()
    while not worker.stop_event.wait(1):
        pass
    worker.stop()
