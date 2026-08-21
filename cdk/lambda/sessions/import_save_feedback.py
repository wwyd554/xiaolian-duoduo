# フィードバック保存モジュールをインポートするための補助ファイル
# これにより、必要なときにsave_feedbackモジュールを簡単にインポートできる
from .save_feedback import save_feedback_to_dynamodb

# 必要に応じて他の関数もエクスポート
__all__ = ['save_feedback_to_dynamodb']
