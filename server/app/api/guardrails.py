"""Guardrails 列表（本地部署桩）。

原 AWS 方案使用 Bedrock Guardrails 做内容安全护栏，本地部署不接入云端，
这里返回一组本地默认护栏，保证前端「场景创建」流程的护栏选择不中断。
实际内容安全由合规检查（compliance）环节兜底。
"""
from fastapi import APIRouter

router = APIRouter(prefix="/guardrails", tags=["guardrails"])

# 本地默认护栏：仅占位，前端可用于下拉选择；后端入库时不依赖云端 ARN。
LOCAL_GUARDRAILS = [
    {
        "id": "default",
        "arn": "local://guardrail/default",
        "name": "通用合规护栏",
        "description": "本地部署默认护栏（未接入云端 Guardrails，内容安全由合规检查兜底）",
    }
]


@router.get("")
def list_guardrails():
    return {"guardrails": LOCAL_GUARDRAILS}
