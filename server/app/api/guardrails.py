"""Describe the actual local rule baseline, without claiming cloud moderation."""
from fastapi import APIRouter
from ..config import settings

router = APIRouter(prefix="/guardrails", tags=["guardrails"])

LOCAL_GUARDRAILS = [
    {
        "id": "default",
        "arn": "local://guardrail/default",
        "name": "通用合规护栏",
        "description": "本地规则基线：凭证材料阻断、资料越权指令检查及部分危险销售输出拦截；非完整内容审核服务。",
    }
]


@router.get("")
def list_guardrails():
    return {"guardrails": LOCAL_GUARDRAILS, "runtimeEnforced": settings.harness_runtime_enabled,
            "policyVersion": "local-sales-v1"}
