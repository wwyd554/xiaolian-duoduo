"""认证路由：邀请码注册 + 当前用户查询。"""
from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..auth.jwt import UserInfo, create_token, get_current_user
from ..database import db
from ..models import RegisterRequest, RegisterResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def generate_invite_codes(count: int) -> list[str]:
    """生成 count 个邀请码，形如 XXXX-XXXX-XXXX（无易混淆字符）。"""
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace("0", "").replace("1", "")
    codes = []
    for _ in range(count):
        part = "".join(secrets.choice(alphabet) for _ in range(12))
        codes.append(f"{part[:4]}-{part[4:8]}-{part[8:]}")
    return codes


@router.post("/register", response_model=RegisterResponse)
def register(body: RegisterRequest):
    """邀请码 + 昵称 → 创建用户 + 签发 JWT。"""
    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(400, "昵称不能为空")
    if len(nickname) > 30:
        raise HTTPException(400, "昵称最长 30 个字符")

    code = body.inviteCode.strip().upper()
    now = datetime.now(timezone.utc).isoformat()

    with db() as conn:
        row = conn.execute("SELECT * FROM invite_codes WHERE code = ?", (code,)).fetchone()
        if row is None:
            raise HTTPException(400, "邀请码不存在")
        if row["used_by"] is not None:
            raise HTTPException(400, "邀请码已被使用")

        user_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, nickname, invite_code, is_admin, created_at) VALUES (?, ?, ?, 0, ?)",
            (user_id, nickname, code, now),
        )
        conn.execute(
            "UPDATE invite_codes SET used_by = ?, used_at = ? WHERE code = ?",
            (user_id, now, code),
        )

    token = create_token(user_id, nickname, False)
    return RegisterResponse(success=True, userId=user_id, nickname=nickname, token=token, isAdmin=False)


@router.get("/me")
def me(user: UserInfo = Depends(get_current_user)):
    return {
        "userId": user.user_id,
        "nickname": user.nickname,
        "isAdmin": user.is_admin,
    }
