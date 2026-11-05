"""Pydantic 请求/响应模型（与前端契约对齐）。"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


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
    practiceSourceSessionId: Optional[str] = Field(default=None, min_length=1, max_length=128)
    practiceCriterionId: Optional[str] = Field(default=None, pattern=r"^S[1-5]$")

    @model_validator(mode="after")
    def validate_practice_source(self):
        if bool(self.practiceSourceSessionId) != bool(self.practiceCriterionId):
            raise ValueError("再练来源与训练考点必须同时提供")
        return self


class PracticePlanRequest(BaseModel):
    criterionId: Optional[str] = Field(default=None, pattern=r"^S[1-5]$")


class CreateSessionResponse(BaseModel):
    success: bool
    sessionId: str
    message: str
    isNew: bool


class CompleteSessionResponse(BaseModel):
    success: bool
    sessionId: str
    status: str
    message: str


# ---------- 对话 ----------
class SendMessageRequest(BaseModel):
    content: str
    npcInfo: Optional[dict[str, Any]] = None
    emotionParams: Optional[dict[str, Any]] = None
    goals: Optional[list[dict[str, Any]]] = None
    goalStatuses: Optional[list[dict[str, Any]]] = None
    scenarioDescription: Optional[str] = None
    language: Optional[str] = "zh"


class SendMessageResponse(BaseModel):
    success: bool
    response: str
    sessionId: str
    messageId: str
    metrics: dict[str, Any]
    analysis: str
    goalUpdates: list[dict[str, Any]]
    suggestions: list[str]
    npcEmotion: str
    npcEmotionIntensity: float
    gesture: str
    sessionCompleted: bool
    turnsUsed: int
    maxTurns: int


# ---------- 场景 ----------
class ScenarioShareRequest(BaseModel):
    visibility: str
    sharedWithUsers: Optional[list[str]] = None
