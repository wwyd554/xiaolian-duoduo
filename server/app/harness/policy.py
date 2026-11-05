"""Authority is supplied by application code, never by model arguments."""
from .safety import SafetyViolation


class ToolDenied(ValueError):
    pass


def authorize(context, spec):
    if context.user_id != context.state.userId:
        raise ToolDenied("owner_mismatch")
    if context.role not in spec.roles or spec.effect == "external_sensitive":
        raise ToolDenied("role_denied")
    if context.state.stage == "completed" and spec.effect != "read":
        raise ToolDenied("session_completed")


def public_error(exc):
    if isinstance(exc, ToolDenied):
        if str(exc) in {"tool_budget_exceeded", "result_budget_exceeded", "invalid_evidence", "unknown_evidence"}:
            return str(exc)
        return "permission_denied"
    if isinstance(exc, SafetyViolation):
        return "unsafe_content"
    return "invalid_arguments"
