"""FastAPI 应用入口。

启动：cd server && uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import analysis, guardrails, scenarios, sessions, transcribe, tts, reviews, audio_transcription
from .auth import routes as auth_routes
from .database import init_db
from .services.seed import seed_scenarios
from .config import settings
from .workers.jobs import ReviewWorker
from .harness.observability import emit, trace_id
from .harness.logging_filters import WebSocketTokenFilter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
for name in ("uvicorn.error", "uvicorn.access"):
    logging.getLogger(name).addFilter(WebSocketTokenFilter())

@asynccontextmanager
async def lifespan(app):
    settings.validate()
    init_db()
    seed_scenarios()
    worker = ReviewWorker()
    if settings.job_worker_enabled:
        worker.start()
    try:
        yield
    finally:
        worker.stop()


app = FastAPI(title="销练多多 API", version="0.2.0", lifespan=lifespan)

# 明确来源；生产环境在 lifespan 校验 HTTPS 来源。
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Trace-ID"],
)


@app.middleware("http")
async def trace_request(request, call_next):
    token = trace_id.set(uuid.uuid4().hex)
    started = time.monotonic()
    status = 500
    try:
        try:
            response = await call_next(request)
        except Exception as exc:
            emit("http_error", error_type=type(exc).__name__)
            response = JSONResponse(status_code=500, content={"detail": "服务暂时不可用，请稍后重试"})
            origin = request.headers.get("origin")
            if origin in settings.cors_origins:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Expose-Headers"] = "X-Trace-ID"
                response.headers["Vary"] = "Origin"
        response.headers["X-Trace-ID"] = trace_id.get()
        status = response.status_code
        return response
    finally:
        route = request.scope.get("route")
        emit("http_request", method=request.method, route=getattr(route, "path", "unmatched"),
             status_code=status, elapsed_ms=round((time.monotonic() - started) * 1000))
        trace_id.reset(token)

app.include_router(auth_routes.router)
app.include_router(scenarios.router)
app.include_router(sessions.router)
app.include_router(tts.router)
app.include_router(transcribe.router)
app.include_router(analysis.router)
app.include_router(guardrails.router)
app.include_router(audio_transcription.router)
app.include_router(reviews.router)


@app.get("/health")
def health():
    return {"status": "ok"}
