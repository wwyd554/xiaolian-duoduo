# プロンプトファイル

このディレクトリには、AI分析エンジンで使用されるプロンプトテンプレートが含まれています。

## ファイル構成

- `__init__.py` - プロンプト生成関数を提供
- `analysis_prompt.py` - 会話分析用のプロンプトテンプレート

## 使い方

```python
from prompts import get_analysis_prompt

# プロンプトの生成
prompt = get_analysis_prompt(
    anger_value=3,
    trust_value=7,
    progress_value=5,
    conversation_text="会話履歴...",
    goal_analysis_section="目標分析セクション..."
)
```
