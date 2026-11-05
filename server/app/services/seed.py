"""Import legacy scenes once and add versioned curated scenes without replacing data."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from ..config import settings
from ..database import db
from .business_review import build_rubric_snapshot

logger = logging.getLogger("seed")
CURATED_SCENARIOS_PATH = settings.scenarios_seed_path.with_name("curated_scenarios.json")


def _read_scenarios(path: Path) -> list[dict]:
    if not path.exists():
        logger.warning("种子文件不存在: %s", path)
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    scenarios = data.get("scenarios", [])
    if not isinstance(scenarios, list) or any(not isinstance(sc, dict) for sc in scenarios):
        raise ValueError("场景种子必须包含对象数组 scenarios")
    return scenarios


def seed_scenarios(force: bool = False) -> int:
    """Seed an empty library, then add missing curated IDs on every startup.

    force=True also adds missing legacy IDs. Existing built-in, curated and user
    records are never replaced, including when IDs collide. New curated content
    uses a new versioned ID instead of silently changing existing practice data.
    """
    with db() as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM scenarios").fetchone()["c"]
        legacy = _read_scenarios(settings.scenarios_seed_path) if not count or force else []
        curated = _read_scenarios(CURATED_SCENARIOS_PATH)
        # Fail atomically if a packaged example cannot produce a valid frozen rubric.
        for scenario in curated:
            build_rubric_snapshot(scenario)
        now = datetime.now(timezone.utc).isoformat()
        inserted = 0
        for sc in legacy + curated:
            sid = sc.get("id") or sc.get("scenarioId")
            if not sid:
                continue
            doc = dict(sc)
            doc.setdefault("visibility", "public")
            doc.setdefault("createdBy", "system")
            cursor = conn.execute(
                "INSERT OR IGNORE INTO scenarios (id, data, created_by, is_custom, created_at, updated_at) "
                "VALUES (?, ?, ?, 0, ?, ?)",
                (sid, json.dumps(doc, ensure_ascii=False), "system", now, now),
            )
            inserted += cursor.rowcount
        if inserted:
            logger.info("场景种子数据新增完成: %d 个（保留已有场景）", inserted)
        return inserted
