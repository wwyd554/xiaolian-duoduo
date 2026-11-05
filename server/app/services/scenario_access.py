"""Canonical scene visibility check, shared by detail lookup and session creation."""
import json
from fastapi import HTTPException


def assert_readable(row, user):
    if row is None:
        raise HTTPException(404, "场景不存在")
    doc = json.loads(row["data"])
    owner = doc.get("createdBy") or row["created_by"] or "system"
    visibility = doc.get("visibility", "public")
    if user and (user.is_admin or owner == user.user_id):
        return doc
    if visibility == "public":
        return doc
    if visibility == "shared" and user and user.user_id in (doc.get("sharedWithUsers") or []):
        return doc
    raise HTTPException(403, "无权限访问此场景")
