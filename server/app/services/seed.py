"""场景种子数据导入：首次启动时把 server/data/scenarios.json 灌入 scenarios 表。"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from ..config import settings
from ..database import db

logger = logging.getLogger("seed")


def seed_scenarios(force: bool = False) -> int:
    """scenarios 表为空时导入种子数据。返回导入条数。"""
    if not settings.scenarios_seed_path.exists():
        logger.warning("种子文件不存在: %s", settings.scenarios_seed_path)
        return 0

    with db() as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM scenarios").fetchone()["c"]
        if count > 0 and not force:
            return 0

        data = json.loads(settings.scenarios_seed_path.read_text(encoding="utf-8"))
        scenarios = data.get("scenarios", [])
        now = datetime.now(timezone.utc).isoformat()
        inserted = 0
        for sc in scenarios:
            sid = sc.get("id") or sc.get("scenarioId")
            if not sid:
                continue
            doc = dict(sc)
            doc.setdefault("visibility", "public")
            doc.setdefault("createdBy", "system")
            conn.execute(
                "INSERT OR REPLACE INTO scenarios (id, data, created_by, is_custom, created_at, updated_at) "
                "VALUES (?, ?, ?, 0, ?, ?)",
                (sid, json.dumps(doc, ensure_ascii=False), "system", now, now),
            )
            inserted += 1
        logger.info("场景种子数据导入完成: %d 个", inserted)
        return inserted
