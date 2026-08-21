"""
音声分析用プロンプト定義

話者の役割特定のためのプロンプトテンプレート。
"""

def get_speaker_analysis_prompt(speaker_utterances: dict, language: str = "zh") -> str:
    """
    生成说话人角色分析用提示词
    
    Args:
        speaker_utterances: 按说话人标签的发言列表
        language: 语言代码（zh/ja/en）
        
    Returns:
        str: 分析用提示词
    """
    if language == "en":
        return _create_english_analysis_prompt(speaker_utterances)
    elif language == "zh":
        return _create_chinese_analysis_prompt(speaker_utterances)
    else:
        return _create_japanese_analysis_prompt(speaker_utterances)

def _create_japanese_analysis_prompt(speaker_utterances: dict) -> str:
    """日本語用の分析プロンプトを作成"""
    
    speaker_info_text = ""
    for speaker_label, utterances in speaker_utterances.items():
        sample_utterances = utterances[:5]  # 最初の5つの発言をサンプルとして使用
        speaker_info_text += f"\n{speaker_label}: {' | '.join(sample_utterances)}"
    
    return f"""
あなたは営業会話の音声分析専門家です。以下の会話の転写テキストから、各話者の役割を特定してください。

## 話者別の発言内容:
{speaker_info_text}

## 分析タスク:
各話者について以下を特定してください：
1. 役割（salesperson: 営業担当者、customer: 顧客、observer: 観察者/その他）
2. 信頼度（0.0-1.0の範囲）
3. 代表的な発言例（最大3つ）

## 分析のポイント:
- 営業担当者: 商品説明、提案、質問、クロージング、価格提示を行う
  例: 「こちらの商品はいかがでしょうか」「ご予算はどの程度でしょうか」「資料をお持ちしました」
- 顧客: 質問、懸念表明、意思決定に関わる発言をする
  例: 「価格が気になります」「検討させてください」「どのような効果がありますか」
- 観察者: 会話に参加しない、または補助的な発言のみ
  例: 「失礼します」「お疲れさまです」「会議室はこちらです」

## 出力要件:
各話者に対してSpeakerInfoオブジェクトを生成してください。
- speaker_label: 話者ラベル（そのまま）
- identified_role: 特定した役割（salesperson/customer/observer）
- confidence: 信頼度（発言内容の特徴の明確さに基づく0.0-1.0）
- sample_utterances: 代表的な発言例（最大3つ）

信頼度の設定基準:
- 0.9-1.0: 役割が非常に明確（専門用語、典型的な営業/顧客の発言パターン）
- 0.7-0.8: 役割がある程度明確（文脈から判断可能）
- 0.5-0.6: 役割がやや不明確（一般的な会話）
- 0.0-0.4: 役割が不明確（判断材料が少ない）
"""

def _create_chinese_analysis_prompt(speaker_utterances: dict) -> str:
    """中文用分析提示词"""
    
    speaker_info_text = ""
    for speaker_label, utterances in speaker_utterances.items():
        sample_utterances = utterances[:5]  # 使用前 5 条发言作为样本
        speaker_info_text += f"\n{speaker_label}: {' | '.join(sample_utterances)}"
    
    return f"""
你是销售对话的语音分析专家。请从以下对话转录文本中判断每位说话人的角色。

## 各说话人的发言内容:
{speaker_info_text}

## 分析任务:
请对每位说话人判断以下内容：
1. 角色（salesperson: 销售人员、customer: 客户、observer: 旁观者/其他）
2. 置信度（0.0-1.0 范围）
3. 代表性发言示例（最多 3 条）

## 分析要点:
- 销售人员: 进行商品说明、提案、提问、促成成交、报价
  例: 「这款产品怎么样」「您的预算大概是多少」「我带来了资料」
- 客户: 提问、表达顾虑、做出与决策相关的发言
  例: 「价格让我有点在意」「请让我考虑一下」「有什么效果」
- 旁观者: 不参与对话，或仅有辅助性发言
  例: 「失陪一下」「辛苦了」「会议室在这边」

## 输出要求:
请为每位说话人生成 SpeakerInfo 对象。
- speaker_label: 说话人标签（原样）
- identified_role: 判断出的角色（salesperson/customer/observer）
- confidence: 置信度（基于发言特征清晰度的 0.0-1.0）
- sample_utterances: 代表性发言示例（最多 3 条）

置信度设定标准:
- 0.9-1.0: 角色非常明确（专业术语、典型的销售/客户发言模式）
- 0.7-0.8: 角色较为明确（可从语境判断）
- 0.5-0.6: 角色略显模糊（一般性对话）
- 0.0-0.4: 角色不明确（判断依据较少）
"""

def _create_english_analysis_prompt(speaker_utterances: dict) -> str:
    """英語用の分析プロンプトを作成"""
    
    speaker_info_text = ""
    for speaker_label, utterances in speaker_utterances.items():
        sample_utterances = utterances[:5]  # Use first 5 utterances as samples
        speaker_info_text += f"\n{speaker_label}: {' | '.join(sample_utterances)}"
    
    return f"""
You are a sales conversation audio analysis expert. Please identify the role of each speaker from the following conversation transcript.

## Speaker Utterances:
{speaker_info_text}

## Analysis Task:
For each speaker, identify:
1. Role (salesperson: sales representative, customer: client/prospect, observer: other participant)
2. Confidence level (0.0-1.0 range)
3. Representative utterances (up to 3 examples)

## Analysis Points:
- Salesperson: Provides product explanations, proposals, asks questions, attempts closing, presents pricing
  Examples: "How about this product?" "What's your budget range?" "I brought some materials for you"
- Customer: Asks questions, expresses concerns, makes decision-related statements
  Examples: "I'm concerned about the price" "Let me think about it" "What kind of benefits does this offer?"
- Observer: Limited participation or supportive comments only
  Examples: "Excuse me" "Thank you for your time" "The meeting room is this way"

## Output Requirements:
Generate SpeakerInfo object for each speaker:
- speaker_label: Speaker label (as-is)
- identified_role: Identified role (salesperson/customer/observer)
- confidence: Confidence level (0.0-1.0 based on clarity of role-indicating speech patterns)
- sample_utterances: Representative utterances (up to 3)

Confidence Level Guidelines:
- 0.9-1.0: Role very clear (technical terms, typical sales/customer speech patterns)
- 0.7-0.8: Role somewhat clear (can be determined from context)
- 0.5-0.6: Role somewhat unclear (general conversation)
- 0.0-0.4: Role unclear (insufficient evidence)
"""
