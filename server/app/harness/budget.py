"""Thread-safe, request-scoped reservation. Retries consume budget, never refund."""
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from threading import Lock

from ..config import settings
from .context import encode, estimate_tokens
from .observability import emit


class BudgetExceeded(RuntimeError):
    pass


@dataclass
class ModelBudget:
    max_attempts: int
    max_reserved_tokens: int
    attempts: int = 0
    reserved_tokens: int = 0
    lock: Lock = field(default_factory=Lock)

    def reserve(self, system, messages, output_tokens):
        # Conservative input estimate, output ceiling; not a currency/billing limit.
        amount = estimate_tokens(system + encode(messages)) + 128 + output_tokens
        with self.lock:
            if self.attempts >= self.max_attempts or self.reserved_tokens + amount > self.max_reserved_tokens:
                emit("model_budget", status="denied", budget_exceeded=True)
                raise BudgetExceeded("本轮模型调用预算已用尽，请缩短输入后重试")
            self.attempts += 1
            self.reserved_tokens += amount


active_budget: ContextVar[ModelBudget | None] = ContextVar("model_budget", default=None)


@contextmanager
def turn_budget():
    budget = ModelBudget(settings.runtime_model_attempts, settings.runtime_reserved_tokens)
    token = active_budget.set(budget)
    try:
        yield budget
    finally:
        emit("model_budget", status="finished", attempt=budget.attempts,
             reserved_tokens=budget.reserved_tokens)
        active_budget.reset(token)
