"""Pydantic 请求/响应模型（与前端契约对齐）。"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


# ---------- 认证 ----------
class RegisterRequest(BaseModel):
    inviteCode: str
    nickname: str


class RegisterResponse(BaseModel):
    success: bool
    userId: str
    nickname: str
    token: str
    isAdmin: bool


# ---------- 会话 ----------
class CreateSessionRequest(BaseModel):
    sessionId: Optional[str] = None
    scenarioId: str
    title: Optional[str] = None
    npcInfo: Optional[dict[str, Any]] = None


class CreateSessionResponse(BaseModel):
    success: bool
    sessionId: str
    message: str
    isNew: bool


# ---------- 场景 ----------
class ScenarioShareRequest(BaseModel):
    visibility: str
    sharedWithUsers: Optional[list[str]] = None
