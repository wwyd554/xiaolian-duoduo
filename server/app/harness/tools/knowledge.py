"""Versioned built-in training rules only; no external search or tenant documents."""

RULES = (
    {"id": "confirm-needs", "version": 1, "source": "local://training-rules/confirm-needs/v1",
     "title": "需求确认训练规则", "terms": ("需求", "预算", "时间", "决策", "budget", "need"),
     "content": "训练中需要区分销售方提出的方案与客户明确表达的需求、预算、决策人和时间；条件性表述应保留条件。"},
    {"id": "evidence-boundary", "version": 1, "source": "local://training-rules/evidence-boundary/v1",
     "title": "证据与承诺训练规则", "terms": ("证据", "承诺", "保本", "保证", "风险", "收益", "risk"),
     "content": "销售方单方面承诺不代表客户接受。模拟对话不是对产品收益的核实，不能把未经核实的保证当作已证实事实。"},
)


def retrieve(context, arguments):
    query = arguments.query.casefold()
    matches = [rule for rule in RULES if any(term in query for term in rule["terms"])]
    return {"scope": "builtin_training_rules_only", "documents": [
        {k: v for k, v in rule.items() if k != "terms"} for rule in matches],
        "notice": "仅本地训练规则，不包含企业产品资料，不是外部检索或专业建议。"}
