"""
音声分析エージェント用プロンプト定義
"""


def get_speaker_analysis_prompt(speaker_utterances_text: str, language: str) -> str:
    """生成说话人分析用提示词"""
    if language == 'en':
        return f"""Analyze the following speaker utterances and identify each speaker's role.

Possible roles:
- salesperson: The person selling/presenting products or services
- customer: The person being sold to or asking questions
- observer: Third party or unclear role

Speaker utterances:
{speaker_utterances_text}

Analyze each speaker based on their utterances and determine their role with confidence score."""
    elif language == 'zh':
        return f"""请分析以下说话人的发言，并判断每位说话人的角色。

可能的角色:
- salesperson: 销售/介绍产品或服务的人
- customer: 考虑购买、提问的人
- observer: 第三方或角色不明的人

说话人发言:
{speaker_utterances_text}

请根据每位说话人的发言内容分析其角色，并连同置信度一起给出判定。"""
    else:
        return f"""以下の話者の発言を分析し、各話者の役割を特定してください。

可能な役割:
- salesperson: 製品やサービスを販売/プレゼンする人
- customer: 購入検討者、質問する人
- observer: 第三者または役割が不明確な人

話者の発言:
{speaker_utterances_text}

各話者の発言内容に基づいて役割を分析し、確信度とともに判定してください。"""


def format_speaker_utterances(speaker_utterances: dict) -> str:
    """話者発言をテキスト形式にフォーマット"""
    utterances_text = ""
    for label, utterances in speaker_utterances.items():
        sample = utterances[:5]
        utterances_text += f"\n{label}:\n"
        for u in sample:
            utterances_text += f"  - {u}\n"
    return utterances_text
