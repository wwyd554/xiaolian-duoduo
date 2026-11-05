"""认证模块：JWT 签发 / 校验 / FastAPI 依赖注入。

用户体系：邀请码 + 昵称 → 发 JWT（替代原 Cognito）。
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import settings

_bearer = HTTPBearer(auto_error=False)


@dataclass
class UserInfo:
    user_id: str
    nickname: str
    is_admin: bool


def create_token(user_id: str, nickname: str, is_admin: bool) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "nickname": nickname,
        "is_admin": is_admin,
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_expire_days),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        payload = pyjwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
        if not isinstance(payload.get("sub"), str) or not payload["sub"].strip():
            raise pyjwt.InvalidTokenError("invalid subject")
        return payload
    except pyjwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "登录已过期，请重新登录") from exc
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "无效的登录凭证") from exc


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserInfo:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录")
    payload = decode_token(creds.credentials)
    return UserInfo(
        user_id=payload["sub"],
        nickname=payload.get("nickname", ""),
        is_admin=bool(payload.get("is_admin", False)),
    )


def optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserInfo | None:
    """匿名可访问，带 token 则解析用户（用于公开列表）。"""
    if creds is None:
        return None
    try:
        payload = decode_token(creds.credentials)
    except HTTPException:
        return None
    return UserInfo(
        user_id=payload["sub"],
        nickname=payload.get("nickname", ""),
        is_admin=bool(payload.get("is_admin", False)),
    )
