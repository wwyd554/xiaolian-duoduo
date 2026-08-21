"""
音声分析フィードバック生成用プロンプト定義

save_handler.pyで使用するプロンプト構築関数を定義。
Strands Agentsのstructured outputと組み合わせて使用。
"""

from typing import Dict, Any, List


def build_feedback_prompt(
    metrics: Dict[str, Any],
    messages: List[Dict[str, Any]],
    scenario_goals: List[Dict[str, Any]],
    language: str
) -> str:
    """
    构建反馈生成用提示词
    
    Args:
        metrics: 会话指标（angerLevel, trustLevel, progressLevel）
        messages: 对话消息列表
        scenario_goals: 场景目标列表
        language: 语言（'zh'、'ja' 或 'en'）
        
    Returns:
        反馈生成用提示词字符串
    """
    # 根据语言设置标签
    if language == "en":
        user_label = "Salesperson"
        npc_label = "Customer"
    elif language == "zh":
        user_label = "销售人员"
        npc_label = "客户"
    else:
        user_label = "営業担当者"
        npc_label = "顧客"
    
    # 构建对话文本
    conversation_text = "\n\n".join([
        f"{user_label if msg.get('sender') == 'user' else npc_label}: {msg.get('content', '')}"
        for msg in messages
        if msg.get("sender") in ["user", "npc"]
    ])
    
    # 获取指标值
    anger_value = metrics.get("angerLevel", 1)
    trust_value = metrics.get("trustLevel", 5)
    progress_value = metrics.get("progressLevel", 5)
    
    # 目标分析区块
    goal_section = ""
    if scenario_goals:
        goals_text = "\n".join([f"- {g.get('description', '')}" for g in scenario_goals])
        if language == "en":
            goal_section = f"\n## Scenario Goals\n{goals_text}\n"
        elif language == "zh":
            goal_section = f"\n## 场景目标\n{goals_text}\n"
        else:
            goal_section = f"\n## シナリオのゴール\n{goals_text}\n"
    
    if language == "en":
        return f"""You are an expert sales trainer analyzing a sales conversation from audio transcription.

## Session Metrics
- Anger Level: {anger_value}/10
- Trust Level: {trust_value}/10
- Progress Level: {progress_value}/10

## Conversation (Audio Transcription)
{conversation_text}
{goal_section}

Analyze this sales conversation based on the transcribed audio."""
    elif language == "zh":
        return f"""你是销售培训专家，正在根据音频转录分析一段销售对话。

## 会话指标
- 愤怒等级: {anger_value}/10
- 信任等级: {trust_value}/10
- 进度等级: {progress_value}/10

## 对话内容（音频转录）
{conversation_text}
{goal_section}

请基于音频转录分析这段销售对话。"""
    else:
        return f"""あなたは営業トレーニングの専門家として、音声転写から営業会話を分析します。

## セッションメトリクス
- 怒りレベル: {anger_value}/10
- 信頼レベル: {trust_value}/10
- 進捗レベル: {progress_value}/10

## 会話内容（音声転写）
{conversation_text}
{goal_section}

音声転写に基づいて、この営業会話を分析してください。"""


def get_structured_output_prompt(language: str) -> str:
    """
    获取结构化输出用提示词
    
    用于 Strands Agents 的 structured_output() 方法。
    指示其按照 FeedbackOutput 模型生成输出。
    
    Args:
        language: 语言（'zh'、'ja' 或 'en'）
        
    Returns:
        结构化输出用提示词字符串
    """
    if language == "en":
        return """Generate a FeedbackOutput object with the following:

1. scores: FeedbackScores with:
   - overall: 0-100 total score
   - communication, needsAnalysis, proposalQuality, flexibility, trustBuilding: 1-10 each
   - objectionHandling, closingSkill, listeningSkill, productKnowledge, customerFocus: 1-10 each
   - goalAchievement: 1-10

2. strengths: List of 2-4 specific strengths observed in the conversation

3. improvements: List of 2-4 specific areas for improvement

4. keyInsights: List of 1-2 key insights about the conversation

5. goalFeedback: GoalFeedback with achievedGoals, partiallyAchievedGoals, missedGoals lists

6. overallComment: A comprehensive summary of the performance

7. nextSteps: Recommended next steps for improvement"""
    elif language == "zh":
        return """请按以下内容生成 FeedbackOutput 对象：

1. scores: FeedbackScores 设置如下:
   - overall: 0-100 的综合分数
   - communication, needsAnalysis, proposalQuality, flexibility, trustBuilding: 各 1-10
   - objectionHandling, closingSkill, listeningSkill, productKnowledge, customerFocus: 各 1-10
   - goalAchievement: 1-10

2. strengths: 对话中观察到的 2-4 个具体优点

3. improvements: 2-4 个具体的改进点

4. keyInsights: 关于对话的 1-2 个重要洞察

5. goalFeedback: 包含 achievedGoals, partiallyAchievedGoals, missedGoals 列表的 GoalFeedback

6. overallComment: 表现的综合总结

7. nextSteps: 建议的改进下一步"""
    else:
        return """以下の内容でFeedbackOutputオブジェクトを生成してください：

1. scores: FeedbackScoresに以下を設定:
   - overall: 0-100の総合スコア
   - communication, needsAnalysis, proposalQuality, flexibility, trustBuilding: 各1-10
   - objectionHandling, closingSkill, listeningSkill, productKnowledge, customerFocus: 各1-10
   - goalAchievement: 1-10

2. strengths: 会話で観察された2-4個の具体的な強み

3. improvements: 2-4個の具体的な改善点

4. keyInsights: 会話に関する1-2個の重要な洞察

5. goalFeedback: achievedGoals, partiallyAchievedGoals, missedGoalsリストを含むGoalFeedback

6. overallComment: パフォーマンスの包括的なサマリー

7. nextSteps: 改善のための推奨される次のステップ"""


def create_default_feedback(language: str) -> Dict[str, Any]:
    """
    创建默认反馈
    
    反馈生成出错时返回的默认值。
    
    Args:
        language: 语言（'zh'、'ja' 或 'en'）
        
    Returns:
        默认反馈字典
    """
    # 通用的分数结构
    default_scores = {
        "overall": 50,
        "communication": 5,
        "needsAnalysis": 5,
        "proposalQuality": 5,
        "flexibility": 5,
        "trustBuilding": 5,
        "objectionHandling": 5,
        "closingSkill": 5,
        "listeningSkill": 5,
        "productKnowledge": 5,
        "customerFocus": 5,
        "goalAchievement": 5
    }
    
    # 通用的目标反馈结构
    default_goal_feedback = {
        "achievedGoals": [],
        "partiallyAchievedGoals": [],
        "missedGoals": []
    }
    
    if language == "en":
        strengths = ["Analysis in progress"]
        improvements = ["Analysis in progress"]
        key_insights = ["Analysis in progress"]
        overall_comment = "Feedback generation encountered an issue."
    elif language == "zh":
        strengths = ["分析中"]
        improvements = ["分析中"]
        key_insights = ["分析中"]
        overall_comment = "反馈生成时出现问题。"
    else:
        strengths = ["分析中"]
        improvements = ["分析中"]
        key_insights = ["分析中"]
        overall_comment = "フィードバック生成中に問題が発生しました。"

    return {
        "scores": default_scores,
        "strengths": strengths,
        "improvements": improvements,
        "keyInsights": key_insights,
        "goalFeedback": default_goal_feedback,
        "overallComment": overall_comment,
        "nextSteps": None
    }
