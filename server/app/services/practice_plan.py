"""Server-owned, evidence-scored practice plans; no client-authored instructions."""
from __future__ import annotations

import copy
import json

from fastapi import HTTPException

from .scenario_access import assert_readable


FOCUS_BEHAVIORS = {
    "S1": ("建立沟通与确认议程", "简洁说明来意，确认客户是否方便，并对齐这次交流的重点。",
           "根据场景的时间与关注点回应开场；来意不清时询问此次交流目的，不主动替销售设置议程。"),
    "S2": ("探索并核对需求", "根据客户回答追问具体问题与影响，再复述并确认自己的理解。",
           "围绕场景已有需求自然回答，只在对方问到时逐步提供细节；理解有偏差时指出，不替销售总结需求。"),
    "S3": ("将价值与需求对应", "把有依据的产品事实与客户需求对应，说明使用条件和边界。",
           "针对销售的说明追问它怎样解决你已提出的问题；对于没有依据的效果承诺保持疑问，不替销售解释产品。"),
    "S4": ("理解并回应异议", "认可顾虑、澄清具体原因、给出有依据的回应，再确认顾虑是否解决。",
           "自然表达原场景中的顾虑。回应没有触及顾虑时继续澄清，不因销售重复宣传就认可；不编造新客户背景。"),
    "S5": ("对齐下一步", "与客户确认合适的下一步、负责人和时间；客户明确拒绝时尊重结束。",
           "对含糊的安排询问具体动作与时间，未真正达成一致不要假装同意；保持原场景中客户的决定与边界。"),
}


def focus_context(focus: dict) -> dict:
    """Never forward model-generated report instructions or previous scores to NPC."""
    criterion = focus.get("criterionId")
    values = FOCUS_BEHAVIORS.get(criterion)
    if not values:
        return {}
    return {"criterionId": criterion, "label": values[0], "customerBehavior": values[2]}


def _object(raw: str | None) -> dict:
    try:
        result = json.loads(raw or "{}")
    except (TypeError, ValueError):
        return {}
    return result if isinstance(result, dict) else {}


def load_practice_plan(conn, session_id: str, user, criterion_id: str | None = None) -> tuple[dict, dict, dict]:
    """Return public plan, frozen scenario, rubric. All lookups are owner-scoped."""
    session = conn.execute("SELECT * FROM sessions WHERE id=? AND user_id=?", (session_id, user.user_id)).fetchone()
    if session is None:
        raise HTTPException(404, "会话不存在")
    if session["status"] != "completed":
        raise HTTPException(409, "请先结束练习并完成复盘")
    if conn.execute("SELECT 1 FROM review_imports WHERE session_id=?", (session_id,)).fetchone():
        raise HTTPException(409, "导入复盘尚未绑定陪练场景，请先创建对应场景")
    row = conn.execute("SELECT report_json FROM analysis_reports WHERE session_id=? AND status='completed'", (session_id,)).fetchone()
    report = _object(row["report_json"] if row else None)
    review = report.get("businessReview")
    if not isinstance(review, dict):
        raise HTTPException(409, "这份历史复盘没有业务评分，请先完成一场新版练习")

    # Permission is checked against current scene access, while the exercise itself
    # reuses the previous snapshot so edits do not silently change the comparison.
    scene_row = conn.execute("SELECT * FROM scenarios WHERE id=?", (session["scenario_id"],)).fetchone()
    assert_readable(scene_row, user)
    state_row = conn.execute("SELECT state_json,user_id FROM session_states WHERE session_id=?", (session_id,)).fetchone()
    source_state = _object(state_row["state_json"] if state_row else None)
    if state_row and (state_row["user_id"] != user.user_id or source_state.get("userId") != user.user_id
                      or source_state.get("sessionId") != session_id or source_state.get("scenarioId") != session["scenario_id"]):
        raise HTTPException(409, "原练习快照不一致，请重新练习")
    source_scene = source_state.get("scenario")
    if not isinstance(source_scene, dict) or not source_scene:
        raise HTTPException(409, "原练习场景快照缺失，无法创建同题复练")
    snapshot = source_state.get("rubricSnapshot") or report.get("rubricSnapshot")
    if not isinstance(snapshot, dict):
        raise HTTPException(409, "原评分规则快照缺失，无法创建同标准复练")
    # Unsupported versions must not be silently relabelled with today's rubric.
    from .business_review import build_rubric_snapshot, _validate_snapshot
    try:
        _validate_snapshot(snapshot)
    except (ValueError, TypeError) as exc:
        raise HTTPException(409, "原评分规则快照无效或版本暂不支持，请开始新的练习") from exc
    current = build_rubric_snapshot({})
    if (snapshot.get("rubricId") != current["rubricId"]
            or snapshot.get("rubricVersion") != current["rubricVersion"]
            or review.get("rubricId") != snapshot.get("rubricId")
            or review.get("rubricVersion") != snapshot.get("rubricVersion")):
        raise HTTPException(409, "原评分规则版本暂不支持复练，请开始新的练习")
    rules = snapshot.get("criteria")
    if not isinstance(rules, list) or not rules or any(not isinstance(r, dict) for r in rules):
        raise HTTPException(409, "原评分规则快照不完整")
    rule_ids = [r.get("id") for r in rules]
    if len(set(rule_ids)) != len(rule_ids) or any(rid not in FOCUS_BEHAVIORS for rid in rule_ids):
        raise HTTPException(409, "原评分规则考点无效")
    items = review.get("criteria")
    if not isinstance(items, list):
        raise HTTPException(409, "评分结果缺少训练考点")
    candidates = {item["id"]: item for item in items
                  if isinstance(item, dict) and item.get("id") in rule_ids
                  and item.get("status") == "assessed" and type(item.get("score")) is int
                  and item["score"] in (0, 1)}
    if criterion_id and criterion_id not in candidates:
        raise HTTPException(409, "该考点尚未评估或已完整做到，请选择一个待改进考点")
    if not candidates:
        raise HTTPException(409, "这份复盘暂无已评估的待改进考点")
    coaching = review.get("coaching") or {}
    preferred = coaching.get("focusCriterionId") if isinstance(coaching, dict) else None
    chosen = criterion_id or (preferred if preferred in candidates else min(candidates, key=lambda key: candidates[key]["score"]))
    item = candidates[chosen]
    # The plan itself is assembled from registered business actions, not arbitrary
    # language in an LLM report. This remains safe to display and carry into a route.
    plan = {"scenarioId": session["scenario_id"], "sourceSessionId": session_id,
            "criterionId": chosen, "label": FOCUS_BEHAVIORS[chosen][0],
            "instruction": FOCUS_BEHAVIORS[chosen][1], "previousScore": item["score"],
            "rubricVersion": snapshot["rubricVersion"]}
    return plan, copy.deepcopy(source_scene), copy.deepcopy(snapshot)
