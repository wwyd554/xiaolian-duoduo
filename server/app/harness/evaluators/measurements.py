"""Reported usage only; no invented prices, missing usage is not zero usage."""


def summarize_usage(events):
    calls = [e for e in events if e["event"] == "model_call"]
    fields = ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
    totals = {}
    for field in fields:
        values = [e[field] for e in calls if type(e.get(field)) is int]
        totals[field] = {"reportedTotal": sum(values) if values else None,
                         "reportingCalls": len(values), "complete": bool(calls) and len(values) == len(calls)}
    return {"observedModelAttempts": len(calls), "usage": totals,
            "calls": [{key: call.get(key) for key in ("label", "model", "status", "attempt", "elapsed_ms", *fields)} for call in calls],
            "cost": None, "costNote": "未配置经核实的供应商价格；缓存用量单列，失败调用可能缺失用量。不据此推算金额。"}
