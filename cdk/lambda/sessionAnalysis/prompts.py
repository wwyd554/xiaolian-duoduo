"""
セッション分析フィードバック生成用プロンプト定義

feedback_handler.pyで使用するプロンプト構築関数を定義。
Strands Agentsのstructured outputと組み合わせて使用。
"""

from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)


def build_feedback_prompt(
    metrics: Dict[str, Any],
    messages: List[Dict[str, Any]],
    scenario_goals: List[Dict[str, Any]],
    language: str,
    slide_history: List[Dict[str, Any]] = None,
    realtime_goal_statuses: List[Dict[str, Any]] = None
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
        user_label = "User"
        npc_label = "NPC"
    elif language == "zh":
        user_label = "销售人员"
        npc_label = "客户"
    else:
        user_label = "ユーザー"
        npc_label = "NPC"
    
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
        # 将会话中的目标进度转换为映射
        status_map = {}
        if realtime_goal_statuses:
            for s in realtime_goal_statuses:
                status_map[s.get("goalId", "")] = s
        
        # 输出目标 ID 匹配情况日志（早期发现不一致）
        scenario_goal_ids = {g.get("id", "") for g in scenario_goals}
        realtime_goal_ids = set(status_map.keys())
        unmatched_ids = realtime_goal_ids - scenario_goal_ids
        if unmatched_ids:
            logger.warning("实时进度中存在与场景目标不一致的 ID", extra={
                "unmatched_goal_ids": list(unmatched_ids),
                "scenario_goal_ids": list(scenario_goal_ids),
            })
        
        goal_lines = []
        for g in scenario_goals:
            goal_id = g.get("id", "")
            description = g.get("description", "")
            status = status_map.get(goal_id, {})
            achieved = status.get("achieved", False)
            progress = status.get("progress", 0)
            
            if language == "en":
                if achieved:
                    goal_lines.append(f"- {description} [Achieved during session, progress: {progress}%]")
                elif progress > 0:
                    goal_lines.append(f"- {description} [Partially achieved during session, progress: {progress}%]")
                else:
                    goal_lines.append(f"- {description} [Not achieved during session]")
            elif language == "zh":
                if achieved:
                    goal_lines.append(f"- {description} [会话中已达成，进度: {progress}%]")
                elif progress > 0:
                    goal_lines.append(f"- {description} [会话中部分达成，进度: {progress}%]")
                else:
                    goal_lines.append(f"- {description} [会话中未达成]")
            else:
                if achieved:
                    goal_lines.append(f"- {description} [セッション中に達成済み、進捗: {progress}%]")
                elif progress > 0:
                    goal_lines.append(f"- {description} [セッション中に部分達成、進捗: {progress}%]")
                else:
                    goal_lines.append(f"- {description} [セッション中に未達成]")
        
        goals_text = "\n".join(goal_lines)
        if language == "en":
            goal_section = f"\n## Scenario Goals (with realtime progress from session)\n{goals_text}\n"
        elif language == "zh":
            goal_section = f"\n## 场景目标（含会话中的实时进度）\n{goals_text}\n"
        else:
            goal_section = f"\n## シナリオのゴール（セッション中のリアルタイム進捗付き）\n{goals_text}\n"
    
    # 幻灯片展示历史区块
    slide_section = ""
    if slide_history:
        if language == "en":
            slide_lines = ["\n## Slide Presentation History"]
            slide_lines.append("The salesperson presented the following slides during the conversation:")
            for entry in slide_history:
                page = entry.get('pageNumber', '?')
                msg_id = entry.get('messageId', '')
                slide_lines.append(f"- Slide {page} (presented at message: {msg_id})")
            slide_lines.append("\nEvaluate the slide usage:")
            slide_lines.append("- Was the timing of each slide presentation appropriate?")
            slide_lines.append("- Were the presented slides relevant to the conversation topic?")
            slide_lines.append("- Was the presentation order logical?")
            slide_section = "\n".join(slide_lines) + "\n"
        elif language == "zh":
            slide_lines = ["\n## 幻灯片展示历史"]
            slide_lines.append("销售人员在对话中展示了以下幻灯片:")
            for entry in slide_history:
                page = entry.get('pageNumber', '?')
                msg_id = entry.get('messageId', '')
                slide_lines.append(f"- 幻灯片{page}（在消息: {msg_id} 时展示）")
            slide_lines.append("\n请评估幻灯片的运用:")
            slide_lines.append("- 每张幻灯片的展示时机是否恰当？")
            slide_lines.append("- 展示的幻灯片是否与对话主题相关？")
            slide_lines.append("- 展示顺序是否合乎逻辑？")
            slide_section = "\n".join(slide_lines) + "\n"
        else:
            slide_lines = ["\n## スライド提示履歴"]
            slide_lines.append("営業担当者は会話中に以下のスライドを提示しました:")
            for entry in slide_history:
                page = entry.get('pageNumber', '?')
                msg_id = entry.get('messageId', '')
                slide_lines.append(f"- スライド{page}（メッセージ: {msg_id}で提示）")
            slide_lines.append("\nスライドの活用を評価してください:")
            slide_lines.append("- 各スライドの提示タイミングは適切でしたか？")
            slide_lines.append("- 提示されたスライドは会話のトピックに関連していましたか？")
            slide_lines.append("- 提示順序は論理的でしたか？")
            slide_section = "\n".join(slide_lines) + "\n"
    
    if language == "en":
        return f"""You are an expert sales trainer analyzing a sales roleplay session.

## Session Metrics
- Anger Level: {anger_value}/10
- Trust Level: {trust_value}/10
- Progress Level: {progress_value}/10

## Conversation (This is the COMPLETE and ONLY conversation that occurred)
{conversation_text}
{goal_section}
{slide_section}
**CRITICAL INSTRUCTIONS - READ CAREFULLY:**
1. The conversation above is the COMPLETE record. There is NO other dialogue.
2. Base your analysis ONLY on what the salesperson (User) actually said in the conversation above.
3. DO NOT assume or invent any actions, intentions, or behaviors not explicitly shown.
4. If the salesperson did not attempt sales talk, product explanation, or any professional behavior, state that clearly.
5. DO NOT give credit for actions that did not occur.
6. When describing strengths, only mention behaviors that are actually visible in the conversation.
7. If there are no positive behaviors to mention, it is acceptable to have an empty or minimal strengths list.

Analyze this sales conversation based STRICTLY on what actually happened."""
    elif language == "zh":
        return f"""你是销售培训专家，正在分析一次销售角色扮演会话。

## 会话指标
- 愤怒等级: {anger_value}/10
- 信任等级: {trust_value}/10
- 进度等级: {progress_value}/10

## 对话内容（这是发生的完整且唯一的对话）
{conversation_text}
{goal_section}
{slide_section}
**重要指示 - 请仔细阅读:**
1. 以上对话是完整记录，不存在其他对话。
2. 请仅基于销售人员（用户）在以上对话中实际说过的话进行分析。
3. 不要臆想或编造任何未明确展示的行为、意图或表现。
4. 如果销售人员没有尝试销售话术、产品说明或任何专业行为，请明确说明。
5. 不要为未发生的行为给予好评。
6. 描述优点时，只提及对话中实际可见的行为。
7. 如果没有值得一提的正面行为，优点列表为空或极少也是可以接受的。

请严格基于实际发生的情况分析这段销售对话。"""
    else:
        return f"""あなたは営業トレーニングの専門家として、営業ロールプレイセッションを分析します。

## セッションメトリクス
- 怒りレベル: {anger_value}/10
- 信頼レベル: {trust_value}/10
- 進捗レベル: {progress_value}/10

## 会話内容（これが発生した完全かつ唯一の会話です）
{conversation_text}
{goal_section}
{slide_section}
**重要な指示 - 注意深く読んでください:**
1. 上記の会話が完全な記録です。他の会話は存在しません。
2. 営業担当者（ユーザー）が上記の会話で実際に言ったことのみに基づいて分析してください。
3. 明示的に示されていない行動、意図、振る舞いを想定したり創作したりしないでください。
4. 営業担当者が営業トーク、商品説明、またはプロフェッショナルな行動を試みていない場合は、それを明確に述べてください。
5. 発生していない行動に対して評価を与えないでください。
6. 強みを説明する際は、会話内で実際に確認できる行動のみを言及してください。
7. 言及すべきポジティブな行動がない場合、強みリストが空または最小限であっても構いません。

実際に起こったことに厳密に基づいて、この営業会話を分析してください。"""


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
