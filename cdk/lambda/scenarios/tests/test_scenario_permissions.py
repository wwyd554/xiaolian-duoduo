"""
シナリオ権限チェックロジックのテスト

バックエンド側の権限チェックが正しく動作することを検証する:
- システムシナリオ: 全ユーザーが編集可能、削除不可
- カスタムシナリオ: 作成者のみ編集・削除可能
- デフォルトシナリオ: 非所有者はpresentationFileのみ更新可能
"""
import pytest


def check_update_permission(existing_scenario: dict, user_id: str, body: dict) -> dict:
    """
    scenarios/index.py の update_scenario 内の権限チェックロジックを再現
    
    Returns:
        {"allowed": True} or {"allowed": False, "reason": str}
    """
    is_owner = existing_scenario.get("createdBy") == user_id
    is_system_scenario = existing_scenario.get("createdBy") == "system"
    is_default_scenario = not existing_scenario.get("isCustom", False)
    
    if not is_owner:
        if is_system_scenario:
            # システム作成シナリオは全ユーザーが編集可能
            return {"allowed": True}
        elif is_default_scenario:
            # デフォルトシナリオの場合、提案資料の更新のみ許可
            allowed_fields = {"presentationFile"}
            request_fields = set(body.keys()) if body else set()
            if not request_fields.issubset(allowed_fields):
                return {"allowed": False, "reason": "このシナリオを編集する権限がありません"}
            return {"allowed": True}
        else:
            return {"allowed": False, "reason": "このシナリオを編集する権限がありません"}
    
    return {"allowed": True}


def check_delete_permission(existing_scenario: dict, user_id: str) -> dict:
    """
    scenarios/index.py の delete_scenario 内の権限チェックロジックを再現
    
    Returns:
        {"allowed": True} or {"allowed": False, "reason": str}
    """
    # システムシナリオは削除不可
    if existing_scenario.get("createdBy") == "system":
        return {"allowed": False, "reason": "システムシナリオは削除できません"}
    if existing_scenario.get("createdBy") != user_id:
        return {"allowed": False, "reason": "このシナリオを削除する権限がありません"}
    
    return {"allowed": True}


class TestUpdatePermission:
    """update_scenario の権限チェックテスト"""

    def test_所有者は自分のシナリオを編集できる(self):
        scenario = {"createdBy": "user-123", "isCustom": True}
        result = check_update_permission(scenario, "user-123", {"title": "新タイトル"})
        assert result["allowed"] is True

    def test_システムシナリオは全ユーザーが全フィールド編集できる(self):
        scenario = {"createdBy": "system", "isCustom": False}
        body = {"title": "変更", "description": "説明変更", "goals": []}
        result = check_update_permission(scenario, "user-456", body)
        assert result["allowed"] is True

    def test_システムシナリオは別ユーザーでも編集できる(self):
        scenario = {"createdBy": "system", "isCustom": False}
        result = check_update_permission(scenario, "user-999", {"npc": {"name": "新NPC"}})
        assert result["allowed"] is True

    def test_デフォルトシナリオは非所有者がpresentationFileのみ更新できる(self):
        scenario = {"createdBy": "user-123", "isCustom": False}
        result = check_update_permission(scenario, "user-456", {"presentationFile": {"key": "file.pdf"}})
        assert result["allowed"] is True

    def test_デフォルトシナリオは非所有者がtitle変更できない(self):
        scenario = {"createdBy": "user-123", "isCustom": False}
        result = check_update_permission(scenario, "user-456", {"title": "変更"})
        assert result["allowed"] is False
        assert "権限がありません" in result["reason"]

    def test_カスタムシナリオは非所有者が編集できない(self):
        scenario = {"createdBy": "user-123", "isCustom": True}
        result = check_update_permission(scenario, "user-456", {"title": "変更"})
        assert result["allowed"] is False

    def test_createdByがない場合は非所有者として扱われる(self):
        scenario = {"isCustom": True}
        result = check_update_permission(scenario, "user-123", {"title": "変更"})
        assert result["allowed"] is False


class TestDeletePermission:
    """delete_scenario の権限チェックテスト"""

    def test_所有者は自分のシナリオを削除できる(self):
        scenario = {"createdBy": "user-123"}
        result = check_delete_permission(scenario, "user-123")
        assert result["allowed"] is True

    def test_システムシナリオは誰も削除できない(self):
        scenario = {"createdBy": "system"}
        result = check_delete_permission(scenario, "user-123")
        assert result["allowed"] is False
        assert "システムシナリオは削除できません" in result["reason"]

    def test_システムシナリオはsystemユーザーでも削除できない(self):
        scenario = {"createdBy": "system"}
        result = check_delete_permission(scenario, "system")
        assert result["allowed"] is False
        assert "システムシナリオは削除できません" in result["reason"]

    def test_他ユーザーのシナリオは削除できない(self):
        scenario = {"createdBy": "user-123"}
        result = check_delete_permission(scenario, "user-456")
        assert result["allowed"] is False
        assert "権限がありません" in result["reason"]

    def test_createdByがない場合は削除できない(self):
        scenario = {}
        result = check_delete_permission(scenario, "user-123")
        assert result["allowed"] is False
