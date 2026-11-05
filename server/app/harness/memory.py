"""Extractive memory: retain quotes and attribution, never manufacture facts with a summary."""
import hashlib
import re

from .state import Fact

_KINDS = {
    "budget": r"预算|经费|[万千百]元|每月.{0,8}[块元]|成本上限",
    "need": r"需要|希望|想要|痛点|需求|解决|漏跟进",
    "objection": r"太贵|担心|顾虑|不接受|不满意|风险|反对",
    "decision_maker": r"决策|拍板|审批|负责人|董事长|财务总监|老板",
    "commitment": r"同意|约定|承诺|安排|下周|明天|签约|演示",
}
_UNCERTAIN = re.compile(r"可能|大概|不确定|如果|也许|还没|未定|不清楚|听说")


def extract_facts(messages: list[dict]) -> list[Fact]:
    facts = []
    for message in messages:
        count = 0
        for sentence in re.split(r"(?<=[。！？!?；;\n])", message["content"]):
            quote = sentence.strip()
            # Questions and long excerpts are not promoted to factual memory.
            if not quote or len(quote) > 400 or "?" in quote or "？" in quote:
                continue
            for kind, pattern in _KINDS.items():
                if count >= 8:
                    break
                if re.search(pattern, quote):
                    key = hashlib.sha256(f'{message["id"]}:{kind}:{quote}'.encode()).hexdigest()[:24]
                    facts.append(Fact(id=key, type=kind, value=quote, evidenceMessageId=message["id"],
                                      speaker=message["role"], certainty="uncertain" if _UNCERTAIN.search(quote) else "statement"))
                    count += 1
    return facts


def summarize(messages: list[dict]) -> dict:
    """Rebuild a small chronological digest as messages age; no model-generated conclusions.

    Full messages and structured facts remain persisted. Coverage explicitly describes
    omissions, so this digest is never presented as a complete conversation transcript.
    """
    excerpts = []
    used = 0
    for message in reversed(messages):
        excerpt = message["content"][:100]
        if used + len(excerpt) > 800:
            break
        excerpts.append({"messageId": message["id"], "speaker": message["role"], "excerpt": excerpt,
                         "truncated": len(excerpt) < len(message["content"])})
        used += len(excerpt)
    return {"kind": "extractive", "excerpts": list(reversed(excerpts)),
            "coveredMessageIds": [m["messageId"] for m in reversed(excerpts)],
            "omittedMessages": len(messages) - len(excerpts)}
