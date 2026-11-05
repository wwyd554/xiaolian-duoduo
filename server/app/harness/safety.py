"""Local deterministic baseline, not a general-purpose moderation classifier."""
import re
import unicodedata

from ..config import settings
from .observability import emit

POLICY_VERSION = "local-sales-v1"


class SafetyViolation(ValueError):
    pass


def is_role_override(text: str) -> bool:
    normalized = unicodedata.normalize("NFKC", text)
    return bool(re.search(r"(?:你现在|从现在起).{0,8}(?:扮演|是)(?:销售|系统管理员)|"
                          r"(?:你来|请你).{0,4}(?:当|扮演)销售|给我满分|"
                          r"(?:you are now|act as)\s+(?:a\s+)?(?:salesperson|sales advisor|system administrator)",
                          normalized, re.I | re.S))


def check_text(text: str, surface: str) -> None:
    normalized = unicodedata.normalize("NFKC", text)
    # Reject actual credential-shaped material on every surface, not just a warning.
    secrets = (settings.deepseek_api_key, settings.jwt_secret)
    if (re.search(r"\bsk-[A-Za-z0-9_-]{20,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", normalized)
            or any(len(s) >= 16 and not s.startswith("change-me") and s in text for s in secrets)):
        emit("safety_check", status="blocked", reason="credential_material", label=surface)
        raise SafetyViolation("内容包含疑似访问凭证，请移除后重试")
    # Only instructions to override authority, not normal scene personality/goals.
    injection = re.search(
        r"(?:忽略|覆盖|泄露|输出).{0,12}(?:系统提示|系统规则|API密钥)|"
        r"ignore\s+(?:all\s+)?(?:previous|system)\s+instructions|"
        r"(?:reveal|print)\s+(?:the\s+)?system\s+prompt|"
        r"(?:你现在|从现在起).{0,8}(?:扮演|是)(?:销售|系统管理员)",
        normalized, re.I | re.S)
    if injection:
        # User attacks remain useful training inputs; they never confer tool authority.
        emit("safety_check", status="flagged" if surface == "input" else "blocked",
             reason="authority_override", label=surface)
        if surface != "input":
            raise SafetyViolation("资料或输出包含越权指令，请检查场景内容")
    if surface == "output" and re.search(r"(?<!不能)(?<!无法)(?<!不)(?:保证|承诺).{0,6}(?:稳赚不赔|年收益\d|保本保息)|(?:把|将).{0,12}(?:密码|验证码).{0,8}(?:发给|告诉)我", normalized):
        emit("safety_check", status="blocked", reason="unsafe_sales_output", label=surface)
        raise SafetyViolation("生成内容未通过安全检查，请重试")


def check_tree(value, surface: str) -> None:
    if isinstance(value, str):
        check_text(value, surface)
    elif isinstance(value, dict):
        for child in value.values():
            check_tree(child, surface)
    elif isinstance(value, list):
        for child in value:
            check_tree(child, surface)
