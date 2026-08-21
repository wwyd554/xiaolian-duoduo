"""FastAPI 应用入口。

启动：cd server && uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import analysis, guardrails, scenarios, sessions, transcribe, tts
from .auth import routes as auth_routes
from .database import init_db
from .services.seed import seed_scenarios

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="销售陪练助手 API", version="0.1.0")

# CORS：开发期全放开（生产部署时收敛为前端域名）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(scenarios.router)
app.include_router(sessions.router)
app.include_router(tts.router)
app.include_router(transcribe.router)
app.include_router(analysis.router)
app.include_router(guardrails.router)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    n = seed_scenarios()
    if n:
        logging.getLogger("app").info("已导入 %d 个场景种子数据", n)


@app.get("/health")
def health():
    return {"status": "ok"}
