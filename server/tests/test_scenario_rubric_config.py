import copy
import json
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.auth.jwt import UserInfo, get_current_user, optional_user
from app.config import settings
from app.database import SCHEMA, independent_db
from app.main import app


class ScenarioRubricConfigTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        folder = self.stack.enter_context(tempfile.TemporaryDirectory())
        self.stack.enter_context(patch.object(settings, "database_path", Path(folder) / "test.db"))
        self.stack.enter_context(patch.object(settings, "trace_dir", Path(folder) / "traces"))
        for module in ("app.api.scenarios", "app.api.sessions"):
            self.stack.enter_context(patch(f"{module}.db", independent_db))
        self.user = UserInfo(user_id="owner", nickname="创建者", is_admin=False)
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[optional_user] = lambda: self.user
        self.addCleanup(app.dependency_overrides.clear)
        with independent_db() as conn:
            conn.executescript(SCHEMA)
        self.client = TestClient(app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)
        self.body = {"scenarioId": "custom-practice", "title": "价格异议", "description": "确认预算和顾虑",
                     "difficulty": "中级", "category": "通用", "language": "zh", "initialMessage": "有点贵。",
                     "npc": {"name": "测试客户"}, "visibility": "private", "rubricConfig": {
                         "criterionIds": ["S2", "S4"], "objectionRequired": True,
                         "productFacts": ["试用期为七天。"], "productFactsVerified": False}}

    def create(self):
        result = self.client.post("/scenarios", json=self.body)
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def stored(self):
        with independent_db() as conn:
            row = conn.execute("SELECT data FROM scenarios WHERE id='custom-practice'").fetchone()
            return json.loads(row["data"]) if row else None

    def test_create_and_get_preserve_supported_config_including_false(self):
        result = self.create()
        self.assertEqual(result["scenario"]["rubricConfig"], self.body["rubricConfig"])
        self.assertEqual(self.stored()["rubricConfig"], self.body["rubricConfig"])
        response = self.client.get("/scenarios/custom-practice")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rubricConfig"], self.body["rubricConfig"])

    def test_invalid_create_config_returns_400_and_inserts_nothing(self):
        bad_values = [None, [], "S1", {"criterionIds": []}, {"criterionIds": ["S6"]},
                      {"criterionIds": ["S2", "S2"]}, {"criterionIds": "S2"},
                      {"productFacts": [""]}, {"productFacts": "fact"}, {"productFactsVerified": "yes"},
                      {"objectionRequired": 1}, {"transcriptComplete": None},
                      {"weights": {"S2": 999}}, {"rubricVersion": "9.0.0"}]
        for config in bad_values:
            with self.subTest(config=config):
                response = self.client.post("/scenarios", json={**self.body, "rubricConfig": config})
                self.assertEqual(response.status_code, 400, response.text)
                self.assertIsNone(self.stored())

    def test_update_can_change_or_reset_config_and_other_edits_preserve_it(self):
        self.create()
        config = {"criterionIds": ["S3"], "productFacts": [], "productFactsVerified": False}
        response = self.client.put("/scenarios/custom-practice", json={"rubricConfig": config})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.stored()["rubricConfig"], config)
        self.client.put("/scenarios/custom-practice", json={"title": "解释产品"})
        self.assertEqual(self.stored()["rubricConfig"], config)
        response = self.client.put("/scenarios/custom-practice", json={"rubricConfig": {}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.stored()["rubricConfig"], {})

    def test_invalid_update_is_atomic_and_permissions_are_unchanged(self):
        self.create()
        previous = self.stored()
        response = self.client.put("/scenarios/custom-practice", json={"title": "不得被写入", "rubricConfig": {"criterionIds": ["invalid"]}})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.stored(), previous)
        self.user = UserInfo(user_id="other", nickname="其他用户", is_admin=False)
        response = self.client.put("/scenarios/custom-practice", json={"rubricConfig": {"criterionIds": ["S5"]}})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.stored(), previous)
        self.user = UserInfo(user_id="admin", nickname="管理员", is_admin=True)
        response = self.client.put("/scenarios/custom-practice", json={"rubricConfig": {"criterionIds": ["S5"]}})
        self.assertEqual(response.status_code, 200)

    def test_update_does_not_change_existing_session_snapshot(self):
        self.create()
        response = self.client.post("/sessions", json={"sessionId": "before-edit", "scenarioId": "custom-practice"})
        self.assertEqual(response.status_code, 200, response.text)
        original = self.client.get("/sessions/before-edit/practice-state").json()["rubricSnapshot"]
        self.assertEqual(original["criterionIds"], ["S2", "S4"])
        response = self.client.put("/scenarios/custom-practice", json={"rubricConfig": {"criterionIds": ["S3"]}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/sessions/before-edit/practice-state").json()["rubricSnapshot"], original)
        response = self.client.post("/sessions", json={"sessionId": "after-edit", "scenarioId": "custom-practice"})
        self.assertEqual(response.status_code, 200)
        current = self.client.get("/sessions/after-edit/practice-state").json()["rubricSnapshot"]
        self.assertEqual(current["criterionIds"], ["S3"])

    def test_import_preserves_config_and_reports_invalid_item_without_inserting_it(self):
        invalid = copy.deepcopy(self.body)
        invalid.update(scenarioId="invalid-import", rubricConfig={"criterionIds": []})
        response = self.client.post("/scenarios/import", json={"scenarios": [self.body, invalid]})
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual((data["imported"], data["errors"]), (1, 1))
        with independent_db() as conn:
            rows = conn.execute("SELECT data FROM scenarios").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(json.loads(rows[0]["data"])["rubricConfig"], self.body["rubricConfig"])


if __name__ == "__main__":
    unittest.main()
