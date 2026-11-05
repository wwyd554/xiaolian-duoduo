"""Authoritative per-session snapshot. Only application transactions can persist it."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messageId: str
    quote: str = Field(min_length=1, max_length=400)


class Fact(BaseModel):
    id: str
    type: Literal["need", "budget", "objection", "decision_maker", "commitment"]
    value: str
    evidenceMessageId: str
    speaker: Literal["user", "npc"]
    certainty: Literal["statement", "uncertain"] = "statement"
    # These are attributed statements in a simulation, not independently verified facts.


class GoalState(BaseModel):
    goalId: str
    achieved: bool = False
    reason: str = "尚未评估"
    evidence: list[Evidence] = Field(default_factory=list)
    verified: bool = False


class PracticeState(BaseModel):
    schemaVersion: Literal[1] = 1
    sessionId: str
    userId: str
    scenarioId: str
    scenario: dict
    rubricSnapshot: dict = Field(default_factory=dict)
    practiceFocus: dict | None = None
    turn: int = 0
    revision: int = 0
    stage: Literal["needs_discovery", "negotiation", "clarification", "completed"] = "needs_discovery"
    customerState: dict[str, int] = Field(default_factory=lambda: {
        "angerLevel": 1, "trustLevel": 1, "progressLevel": 1})
    goalStatuses: list[GoalState] = Field(default_factory=list)
    facts: list[Fact] = Field(default_factory=list)
    summary: dict = Field(default_factory=dict)
    terminationReason: Literal["user_ended", "goals_achieved", "max_turns", "legacy_completed"] | None = None
    evaluationStatus: str = "not_run"
    contextStats: dict = Field(default_factory=dict)


def messages_for(conn, session_id: str) -> list[dict]:
    return [dict(row) for row in conn.execute(
        "SELECT id,role,content FROM messages WHERE session_id=? AND role IN ('user','npc') "
        "ORDER BY created_at,rowid", (session_id,)).fetchall()]


def load_state(conn, session) -> PracticeState:
    row = conn.execute("SELECT * FROM session_states WHERE session_id=?", (session["id"],)).fetchone()
    if row:
        if row["user_id"] != session["user_id"]:
            raise ValueError("会话状态归属不一致")
        state = PracticeState.model_validate_json(row["state_json"])
        if (state.sessionId != session["id"] or state.userId != session["user_id"]
                or state.scenarioId != session["scenario_id"]):
            raise ValueError("会话状态标识不一致")
        state.revision = row["revision"]
    else:
        source = conn.execute("SELECT data FROM scenarios WHERE id=?", (session["scenario_id"],)).fetchone()
        if not source:
            raise ValueError("场景不存在，无法建立会话状态")
        scenario = json.loads(source["data"])
        if not isinstance(scenario, dict):
            raise ValueError("场景数据损坏")
        state = PracticeState(sessionId=session["id"], userId=session["user_id"],
                              scenarioId=session["scenario_id"], scenario=scenario)
    if not state.rubricSnapshot:
        from ..services.business_review import build_rubric_snapshot
        state.rubricSnapshot = build_rubric_snapshot(state.scenario)
    messages = messages_for(conn, session["id"])
    turns = sum(m["role"] == "user" for m in messages)
    if not row or turns != state.turn:
        # Bootstrap old sessions, or reconcile turns made while the feature flag was off.
        from .memory import extract_facts, summarize
        from ..agents.scoring import parse_scoring_output
        initial = state.scenario.get("initialMetrics") or {}
        last = conn.execute("SELECT metrics,meta FROM messages WHERE session_id=? AND role='npc' "
                            "ORDER BY created_at DESC,rowid DESC LIMIT 1", (session["id"],)).fetchone()
        raw_metrics = (last["metrics"] or "{}") if last else "{}"
        state.customerState = parse_scoring_output(raw_metrics, initial)["scores"]
        metadata = json.loads(last["meta"] or "{}") if last else {}
        old_goals = {g["goalId"]: g for g in metadata.get("goalUpdates", []) if isinstance(g, dict) and "goalId" in g}
        state.goalStatuses = [GoalState(goalId=g["id"], achieved=old_goals.get(g["id"], {}).get("achieved") is True,
                                       reason="旧链路状态，需重新评估证据" if messages else "尚未评估", verified=False)
                              for g in state.scenario.get("goals", []) if isinstance(g, dict) and g.get("id")]
        state.turn = turns
        state.facts = extract_facts(with_opening(state, messages))
        state.summary = summarize(messages)
    if session["status"] == "completed":
        state.stage = "completed"
        state.terminationReason = state.terminationReason or "legacy_completed"
    return state


def with_opening(state: PracticeState, messages: list[dict]) -> list[dict]:
    opening = state.scenario.get("initialMessage")
    return ([{"id": f"opening:{state.sessionId}", "role": "npc", "content": opening}]
            if isinstance(opening, str) and opening else []) + messages


def save_state(conn, state: PracticeState) -> None:
    """Caller holds write transaction. Messages, state and review job commit together."""
    state.revision += 1
    changed = conn.execute(
        "INSERT INTO session_states SELECT ?,?,?,?,? WHERE EXISTS "
        "(SELECT 1 FROM sessions WHERE id=? AND user_id=?) "
        "ON CONFLICT(session_id) DO UPDATE SET state_json=excluded.state_json,"
        "revision=excluded.revision,updated_at=excluded.updated_at",
        (state.sessionId, state.userId, state.model_dump_json(), state.revision,
         datetime.now(timezone.utc).isoformat(), state.sessionId, state.userId),
    ).rowcount
    if not changed:
        raise ValueError("会话已删除，无法保存状态")


def finish_state(conn, session, reason: str) -> PracticeState:
    state = load_state(conn, session)
    if not state.terminationReason or state.terminationReason == "legacy_completed":
        state.terminationReason = reason
    state.stage = "completed"
    save_state(conn, state)
    return state
