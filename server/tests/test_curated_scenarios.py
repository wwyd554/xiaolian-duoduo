import json
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.auth.jwt import UserInfo, get_current_user
from app.config import BASE_DIR, settings
from app.database import SCHEMA, independent_db
from app.harness.context import build_context
from app.harness.state import load_state
from app.main import app
from app.services.seed import seed_scenarios


DEMO_ID = "demo-store-value-v1"


class CuratedScenarioTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        folder = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.stack.enter_context(patch.object(settings, "database_path", Path(folder) / "test.db"))
        self.stack.enter_context(patch.object(settings, "trace_dir", Path(folder) / "traces"))
        self.stack.enter_context(patch.object(settings, "scenarios_seed_path", BASE_DIR / "data" / "scenarios.json"))
        for module in ("app.services.seed", "app.api.sessions"):
            self.stack.enter_context(patch(f"{module}.db", independent_db))
        with independent_db() as conn:
            conn.executescript(SCHEMA)

    def stored(self, scenario_id):
        with independent_db() as conn:
            row = conn.execute("SELECT * FROM scenarios WHERE id=?", (scenario_id,)).fetchone()
            return dict(row) if row else None

    def insert_existing(self, scenario_id, title, custom=1):
        with independent_db() as conn:
            conn.execute("INSERT INTO scenarios(id,data,created_by,is_custom,created_at,updated_at) VALUES (?,?,?,?,'old','old')",
                         (scenario_id, json.dumps({"title": title, "visibility": "private"}), "existing-owner", custom))

    def test_fresh_database_contains_legacy_and_one_curated_scene(self):
        legacy = json.loads((BASE_DIR / "data" / "scenarios.json").read_text())["scenarios"]
        self.assertEqual(seed_scenarios(), len(legacy) + 1)
        for scene in legacy:
            stored = json.loads(self.stored(scene["id"])["data"])
            for key, value in scene.items():
                self.assertEqual(stored[key], value)
        demo = self.stored(DEMO_ID)
        self.assertEqual((demo["is_custom"], demo["created_by"]), (0, "system"))
        self.assertEqual(json.loads(demo["data"])["visibility"], "public")
        self.assertEqual(seed_scenarios(), 0)

    def test_existing_database_gets_demo_without_changing_old_or_user_scenes(self):
        self.insert_existing("contract-renewal", "管理员已修改的原场景", custom=0)
        self.insert_existing("user-private", "用户自己的场景")
        original = {sid: self.stored(sid) for sid in ("contract-renewal", "user-private")}
        self.assertEqual(seed_scenarios(), 1)
        self.assertEqual(seed_scenarios(), 0)
        for sid, row in original.items():
            self.assertEqual(self.stored(sid), row)
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM scenarios").fetchone()[0], 3)

    def test_force_only_fills_missing_ids_and_preserves_colliding_user_data(self):
        self.insert_existing("contract-renewal", "保留已有修改", custom=0)
        self.insert_existing(DEMO_ID, "同 ID 的已有用户记录")
        original = {sid: self.stored(sid) for sid in ("contract-renewal", DEMO_ID)}
        legacy = json.loads((BASE_DIR / "data" / "scenarios.json").read_text())["scenarios"]
        self.assertEqual(seed_scenarios(force=True), len(legacy) - 1)
        for sid, row in original.items():
            self.assertEqual(self.stored(sid), row)
        self.assertEqual(seed_scenarios(force=True), 0)

    def test_missing_legacy_file_does_not_prevent_curated_example_loading(self):
        with patch.object(settings, "scenarios_seed_path", Path("/missing/legacy-scenes.json")):
            self.assertEqual(seed_scenarios(), 1)
        self.assertIsNotNone(self.stored(DEMO_ID))

    def test_invalid_packaged_rubric_rolls_back_entire_seed(self):
        path = settings.database_path.parent / "bad-curated.json"
        path.write_text(json.dumps({"scenarios": [{"id": DEMO_ID, "rubricConfig": {"criterionIds": ["S6"]}}]}))
        with patch("app.services.seed.CURATED_SCENARIOS_PATH", path), self.assertRaises(ValueError):
            seed_scenarios()
        with independent_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM scenarios").fetchone()[0], 0)

    def test_session_freezes_demo_rules_and_npc_receives_product_context(self):
        seed_scenarios()
        user = UserInfo(user_id="demo-learner", nickname="学员", is_admin=False)
        app.dependency_overrides[get_current_user] = lambda: user
        self.addCleanup(app.dependency_overrides.clear)
        client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(client.close)
        response = client.post("/sessions", json={"sessionId": "demo-practice", "scenarioId": DEMO_ID})
        self.assertEqual(response.status_code, 200, response.text)
        snapshot = client.get("/sessions/demo-practice/practice-state").json()["rubricSnapshot"]
        self.assertEqual(snapshot["criterionIds"], ["S1", "S2", "S3", "S4", "S5"])
        self.assertEqual(snapshot["rubricVersion"], "1.0.0")
        self.assertTrue(snapshot["objectionRequired"])
        self.assertTrue(snapshot["productFactsVerified"])
        self.assertIsNone(snapshot["passThreshold"])
        with independent_db() as conn:
            session = conn.execute("SELECT * FROM sessions WHERE id='demo-practice'").fetchone()
            state = load_state(conn, session)
            context = build_context(state, [], {"id": "m1", "role": "user", "content": "方便先了解您现在如何记录会员吗？"},
                                    64000, ["npc", "score", "goals"])
            payload = context.npc_messages()[0]["content"]
            for fact in snapshot["productFacts"][:10]:
                self.assertIn(fact, payload)
            self.assertIn("模拟产品", payload)
            self.assertIn("周末需要自己花约 2 小时汇总", payload)
            self.assertIn("每次只回答最新问题相关的一个重点", payload)
            changed = {**state.scenario, "rubricConfig": {"criterionIds": ["S2"]}}
            conn.execute("UPDATE scenarios SET data=? WHERE id=?", (json.dumps(changed), DEMO_ID))
        self.assertEqual(client.get("/sessions/demo-practice/practice-state").json()["rubricSnapshot"], snapshot)


if __name__ == "__main__":
    unittest.main()
