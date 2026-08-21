"""场景 API：列表 / 详情 / 创建 / 更新 / 删除 / 共享 / 导出 / 导入。

接口契约与原 AWS Lambda（cdk/lambda/scenarios/index.py）保持一致，
存储从 DynamoDB 换成 SQLite（整 JSON 存储，保留嵌套结构）。
S3 / PDF / 幻灯片相关端点在本阶段不提供（本地文件存储另行实现）。
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi import Request

from ..auth.jwt import UserInfo, get_current_user, optional_user
from ..database import db
from ..models import ScenarioShareRequest

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

ID_PATTERN = re.compile(r"^[a-zA-Z0-9-]+$")


def _doc_to_response(doc: dict) -> dict:
    """DB JSON → 前端契约：id → scenarioId。"""
    out = dict(doc)
    if "id" in out and "scenarioId" not in out:
        out["scenarioId"] = out.pop("id")
    return out


def _get_scenario_row(scenario_id: str):
    with db() as conn:
        return conn.execute(
            "SELECT * FROM scenarios WHERE id = ?", (scenario_id,)
        ).fetchone()


def _can_edit(row, user: UserInfo, operation: str) -> None:
    """权限：owner 全权；系统场景仅 admin；默认场景普通用户只读。"""
    doc = json.loads(row["data"])
    created_by = doc.get("createdBy") or row["created_by"]
    is_custom = bool(row["is_custom"] or doc.get("isCustom", False))

    if created_by == user.user_id or user.is_admin:
        return
    if created_by == "system" and operation != "read":
        raise HTTPException(403, "系统场景的操作需要管理员权限")
    if not is_custom and operation != "read":
        raise HTTPException(403, "此场景无操作权限")


@router.get("")
def list_scenarios(
    category: str | None = None,
    difficulty: str | None = None,
    visibility: str | None = None,
    limit: int = 20,
    user: UserInfo | None = Depends(optional_user),
):
    """场景列表（公开 + 自己的 + 共享的）。返回 {scenarios, nextToken}。"""
    limit = 20 if limit < 1 or limit > 100 else limit
    with db() as conn:
        rows = conn.execute(
            "SELECT id, data, created_by, is_custom, created_at, updated_at FROM scenarios ORDER BY updated_at DESC"
        ).fetchall()

    result = []
    for row in rows:
        doc = json.loads(row["data"])
        doc["id"] = row["id"]
        doc.setdefault("createdBy", row["created_by"] or "system")
        doc.setdefault("isCustom", bool(row["is_custom"]))
        doc.setdefault("createdAt", row["created_at"])
        doc.setdefault("updatedAt", row["updated_at"])

        doc_vis = doc.get("visibility", "public")
        # 可见性过滤
        if category and doc.get("category") != category:
            continue
        if difficulty and doc.get("difficulty") != difficulty:
            continue
        if visibility == "private" and not (user and doc.get("createdBy") == user.user_id):
            continue
        if visibility == "shared":
            shared = doc.get("sharedWithUsers", [])
            if not (user and (doc.get("createdBy") == user.user_id or user.user_id in shared)):
                continue
        if user is None:
            if doc_vis != "public":
                continue
        else:
            shared = doc.get("sharedWithUsers", [])
            visible = (
                doc_vis == "public"
                or doc.get("createdBy") == user.user_id
                or (doc_vis == "shared" and user.user_id in shared)
            )
            if not visible:
                continue

        # 列表摘要字段（与原 Lambda 一致）
        scenario = {
            "scenarioId": doc.get("id"),
            "title": doc.get("title", ""),
            "description": doc.get("description", ""),
            "difficulty": doc.get("difficulty", ""),
            "category": doc.get("category", ""),
        }
        for field in ("initialMessage", "language", "industry", "createdBy",
                      "isCustom", "visibility", "createdAt", "updatedAt",
                      "goals", "objectives", "initialMetrics", "maxTurns", "tags"):
            if field in doc:
                scenario[field] = doc[field]
        if "npc" in doc:
            scenario["npcInfo"] = {
                k: doc["npc"].get(k) for k in ("id", "name", "role", "company",
                                               "personality", "avatar", "description")
            }
        result.append(scenario)

    return {"scenarios": result[:limit], "nextToken": None}


@router.get("/{scenario_id}")
def get_scenario(scenario_id: str, user: UserInfo | None = Depends(optional_user)):
    row = _get_scenario_row(scenario_id)
    if row is None:
        raise HTTPException(404, f"场景不存在: {scenario_id}")
    doc = json.loads(row["data"])
    doc["id"] = row["id"]
    doc.setdefault("createdBy", row["created_by"] or "system")
    doc.setdefault("isCustom", bool(row["is_custom"]))
    doc.setdefault("createdAt", row["created_at"])
    doc.setdefault("updatedAt", row["updated_at"])

    vis = doc.get("visibility", "public")
    shared = doc.get("sharedWithUsers", [])
    if vis == "private" and not (user and doc.get("createdBy") == user.user_id):
        raise HTTPException(403, "无权限访问此场景")
    if vis == "shared" and not (user and (doc.get("createdBy") == user.user_id or user.user_id in shared)):
        raise HTTPException(403, "无权限访问此场景")

    return _doc_to_response(doc)


@router.post("")
def create_scenario(body: dict = Body(...), user: UserInfo = Depends(get_current_user)):
    required = ["title", "description", "difficulty", "category", "language", "initialMessage"]
    for field in required:
        if not body.get(field):
            raise HTTPException(400, f"{field} 为必填字段")
    if not isinstance(body.get("npc"), dict):
        raise HTTPException(400, "npc 信息为必填字段")

    scenario_id = body.get("scenarioId")
    if scenario_id:
        if not ID_PATTERN.match(scenario_id) or len(scenario_id) > 50:
            raise HTTPException(400, "场景ID仅允许英数字与连字符，且不超过50字符")
        if _get_scenario_row(scenario_id) is not None:
            raise HTTPException(400, f"场景ID '{scenario_id}' 已存在")
    else:
        scenario_id = str(uuid.uuid4())

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": scenario_id,
        "title": body["title"],
        "description": body["description"],
        "difficulty": body["difficulty"],
        "category": body["category"],
        "npc": body["npc"],
        "createdBy": user.user_id,
        "isCustom": True,
        "visibility": body.get("visibility", "private"),
        "language": body["language"],
        "initialMessage": body["initialMessage"],
        "createdAt": now,
        "updatedAt": now,
    }
    for field in ("goals", "initialMetrics", "objectives", "maxTurns",
                  "avatarId", "presentationFile", "initialSuggestions", "industry"):
        if body.get(field):
            doc[field] = body[field]
    for field in ("enableAvatar", "suggestionEnabled"):
        if isinstance(body.get(field), bool):
            doc[field] = body[field]
    if doc["visibility"] == "shared" and isinstance(body.get("sharedWithUsers"), list):
        doc["sharedWithUsers"] = body["sharedWithUsers"]

    with db() as conn:
        conn.execute(
            "INSERT INTO scenarios (id, data, created_by, is_custom, created_at, updated_at) "
            "VALUES (?, ?, ?, 1, ?, ?)",
            (scenario_id, json.dumps(doc, ensure_ascii=False), user.user_id, now, now),
        )
    return {"message": "场景创建成功", "scenarioId": scenario_id, "scenario": _doc_to_response(doc)}


@router.put("/{scenario_id}")
def update_scenario(scenario_id: str, body: dict = Body(...), user: UserInfo = Depends(get_current_user)):
    row = _get_scenario_row(scenario_id)
    if row is None:
        raise HTTPException(404, f"场景不存在: {scenario_id}")
    _can_edit(row, user, "edit")

    doc = json.loads(row["data"])
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # 可更新字段映射（与原 Lambda 一致，含 presentationFile 特殊处理）
    field_map = {
        "title", "description", "difficulty", "category", "npc", "goals",
        "initialMetrics", "objectives", "visibility", "language",
        "initialMessage", "pdfFiles", "maxTurns", "avatarId",
        "enableAvatar", "suggestionEnabled", "initialSuggestions",
        "presentationFile", "industry", "tags",
    }
    for key in field_map:
        if key in body:
            doc[key] = body[key]

    if body.get("visibility") == "shared" and isinstance(body.get("sharedWithUsers"), list):
        doc["sharedWithUsers"] = body["sharedWithUsers"]
    elif body.get("visibility") in ("public", "private"):
        doc.pop("sharedWithUsers", None)

    with db() as conn:
        conn.execute(
            "UPDATE scenarios SET data = ?, updated_at = ? WHERE id = ?",
            (json.dumps(doc, ensure_ascii=False), doc["updatedAt"], scenario_id),
        )
    return {"message": "场景更新成功", "scenario": _doc_to_response(doc)}


@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: str, user: UserInfo = Depends(get_current_user)):
    row = _get_scenario_row(scenario_id)
    if row is None:
        raise HTTPException(404, f"场景不存在: {scenario_id}")
    _can_edit(row, user, "delete")
    with db() as conn:
        conn.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
    return {
        "message": "场景删除成功",
        "scenarioId": scenario_id,
        "s3Files": {"deleted": 0, "failed": 0},  # 本地化：无 S3
    }


@router.post("/{scenario_id}/share")
def share_scenario(scenario_id: str, body: ScenarioShareRequest, user: UserInfo = Depends(get_current_user)):
    if body.visibility not in ("public", "private", "shared"):
        raise HTTPException(400, "visibility 必须是 public/private/shared")
    row = _get_scenario_row(scenario_id)
    if row is None:
        raise HTTPException(404, f"场景不存在: {scenario_id}")
    doc = json.loads(row["data"])
    if doc.get("createdBy") != user.user_id:
        raise HTTPException(403, "只有场景所有者能修改共享设置")

    doc["visibility"] = body.visibility
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    shared = []
    if body.visibility == "shared":
        if not isinstance(body.sharedWithUsers, list):
            raise HTTPException(400, "sharedWithUsers 列表为必填")
        doc["sharedWithUsers"] = body.sharedWithUsers
        shared = body.sharedWithUsers
    else:
        doc.pop("sharedWithUsers", None)

    with db() as conn:
        conn.execute(
            "UPDATE scenarios SET data = ?, updated_at = ? WHERE id = ?",
            (json.dumps(doc, ensure_ascii=False), doc["updatedAt"], scenario_id),
        )
    return {"message": "共享设置已更新", "visibility": body.visibility, "sharedWithUsers": shared}


@router.get("/{scenario_id}/export")
def export_scenario(scenario_id: str, user: UserInfo | None = Depends(optional_user)):
    row = _get_scenario_row(scenario_id)
    if row is None:
        raise HTTPException(404, f"场景不存在: {scenario_id}")
    doc = json.loads(row["data"])
    doc["id"] = row["id"]
    return {
        "scenarios": [_doc_to_response(doc)],
        "npcs": [doc.get("npc")] if doc.get("npc") else [],
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "exportedBy": user.user_id if user else None,
        "version": "1.0",
    }


@router.post("/import")
def import_scenarios(body: dict = Body(...), user: UserInfo = Depends(get_current_user)):
    scenarios_to_import = body.get("scenarios")
    if not isinstance(scenarios_to_import, list):
        raise HTTPException(400, "scenarios 字段为必填")

    now = datetime.now(timezone.utc).isoformat()
    imported, skipped, errors = [], [], []
    with db() as conn:
        for sc in scenarios_to_import:
            try:
                for field in ("title", "description", "difficulty", "category"):
                    if not sc.get(field):
                        raise ValueError(f"缺少必填字段 {field}")
                original_id = sc.get("scenarioId") or sc.get("id")
                if original_id and _get_scenario_row(original_id) is not None:
                    skipped.append({"originalId": original_id, "title": sc.get("title"), "reason": "场景已存在"})
                    continue

                new_id = str(uuid.uuid4())
                doc = {
                    "id": new_id, "title": sc["title"], "description": sc["description"],
                    "difficulty": sc["difficulty"], "category": sc["category"],
                    "createdBy": user.user_id, "isCustom": True, "visibility": "private",
                    "createdAt": now, "updatedAt": now,
                }
                for field in ("language", "initialMessage", "goals", "initialMetrics",
                              "objectives", "industry", "guardrail", "maxTurns", "tags", "npc"):
                    if field in sc:
                        doc[field] = sc[field]
                conn.execute(
                    "INSERT INTO scenarios (id, data, created_by, is_custom, created_at, updated_at) "
                    "VALUES (?, ?, ?, 1, ?, ?)",
                    (new_id, json.dumps(doc, ensure_ascii=False), user.user_id, now, now),
                )
                imported.append({"originalId": original_id, "newId": new_id, "title": sc["title"]})
            except Exception as exc:  # noqa: BLE001
                errors.append({"scenario": sc.get("title", "Unknown"), "error": str(exc)})

    return {
        "message": "场景导入完成",
        "imported": len(imported),
        "skipped": len(skipped),
        "errors": len(errors),
        "details": {
            "importedScenarios": imported,
            "skippedScenarios": skipped,
            "errors": errors,
        },
    }
