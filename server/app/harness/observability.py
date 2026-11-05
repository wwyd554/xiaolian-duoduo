"""Content-free JSONL telemetry with request/job correlation and bounded retention."""
from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from contextvars import ContextVar
from contextlib import contextmanager
from datetime import datetime, timezone

from ..config import settings

trace_id: ContextVar[str] = ContextVar("trace_id", default="")
_event_sink: ContextVar[list | None] = ContextVar("event_sink", default=None)
_lock = threading.Lock()
_last_cleanup = 0.0
_logger = logging.getLogger("telemetry")
# No prompts, generated content, exception messages, query strings or credentials.
_fields = {
    "label", "model", "attempt", "elapsed_ms", "input_tokens", "output_tokens",
    "status", "error_type", "route", "method", "status_code", "job_id",
    "tool", "decision", "reason", "budget_exceeded", "estimated_input_tokens", "reserved_tokens",
    "cache_read_input_tokens", "cache_creation_input_tokens",
}


@contextmanager
def capture_events():
    """Capture the same sanitized metadata in a request-local evaluation collector."""
    events = []
    token = _event_sink.set(events)
    try:
        yield events
    finally:
        _event_sink.reset(token)


def current_trace() -> str:
    return trace_id.get() or uuid.uuid4().hex


def emit(event: str, **fields) -> None:
    global _last_cleanup
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "trace_id": current_trace(), "event": event,
        **{k: v for k, v in fields.items() if k in _fields},
    }
    try:
        with _lock:
            sink = _event_sink.get()
            if sink is not None:
                sink.append(record.copy())
            directory = settings.trace_dir
            directory.mkdir(parents=True, exist_ok=True)
            now = time.time()
            if now - _last_cleanup > 3600:
                # Only files owned by this telemetry writer; old raw logs are not read.
                for path in directory.glob("events-????-??-??.jsonl"):
                    if not path.is_symlink() and path.stat().st_mtime < now - settings.trace_retention_days * 86400:
                        path.unlink()
                _last_cleanup = now
            path = directory / f"events-{datetime.now(timezone.utc):%Y-%m-%d}.jsonl"
            with path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as exc:
        _logger.warning("telemetry_unavailable error_type=%s", type(exc).__name__)
