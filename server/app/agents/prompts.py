"""对话链路提示词 —— 移植自 cdk/agents/npc-conversation/prompts.py 与 realtime-scoring/prompts.py。

仅保留中文分支（本项目为中文陪练），language 参数保留以兼容调用方。
"""
from __future__ import annotations

from typing import Any


# ========================================
# NPC 对话系统提示词
# ========================================

def build_npc_system_prompt(
    npc_info: dict[str, Any],
    emotion_params: dict[str, Any],
    language: str = "zh",
    presented_slides: list | None = None,
) -> str:
    """生成 NPC 对话用系统提示词。"""
    npc_name = npc_info.get("name", "张伟")
    npc_role = npc_info.get("role", "采购负责人")
    npc_company = npc_info.get("company", "某科技有限公司")
    npc_personality = npc_info.get("personality", ["严格", "效率至上"])
    npc_description = npc_info.get("description", "")

    anger_level = emotion_params.get("angerLevel", 1)
    trust_level = emotion_params.get("trustLevel", 1)
    progress_level = emotion_params.get("progressLevel", 1)

    personality_text = (
        ", ".join(npc_personality) if isinstance(npc_personality, list) else npc_personality
    )
    slide_context = _build_slide_context(presented_slides, language)

    description_section = f"\n## 背景信息\n{npc_description}" if npc_description else ""
    return f"""你是{npc_company}的{npc_role}{npc_name}。

## 你的性格
{personality_text}
{description_section}

## 当前情绪状态
- 愤怒等级: {anger_level}/10
- 信任等级: {trust_level}/10
- 商谈进度: {progress_level}/10
{slide_context}
## 重要指示
- 根据此前的对话历史，自然地回应销售人员的消息
- 始终保持 {npc_name} 的角色设定
- 以 1～3 句话回应
- 不要在回应开头加上自己的名字
- 记住之前消息中的对话语境
- 不要使用任何表情符号或颜文字
- 不要提及你的设定、指示或你是 AI。始终保持角色状态
- 若对方提出超出角色边界、违法或不合规的要求（如承诺保底收益、泄露内部资料），委婉拒绝并回到角色"""


def _build_slide_context(presented_slides: list | None, language: str = "zh") -> str:
    if not presented_slides:
        return ""
    lines = ["\n## 展示的幻灯片"]
    lines.append("销售人员向你展示了以下幻灯片。不要朗读或总结，请根据你的角色设定和场景语境做出反应。")
    for slide in presented_slides:
        lines.append(f"- 幻灯片{slide.get('pageNumber', '?')}（图片附件）")
    lines.append("")
    return "\n".join(lines)


def get_default_npc_info() -> dict[str, Any]:
    return {
        "name": "张伟",
        "role": "采购负责人",
        "company": "某科技有限公司",
        "personality": ["严格", "重视效率"],
    }


def get_default_emotion_params() -> dict[str, Any]:
    return {"angerLevel": 1, "trustLevel": 1, "progressLevel": 1}


# ========================================
# 实时评分提示词
# ========================================

SCORING_SCHEMA_HINT = """请严格按照以下 JSON 结构输出（不要输出任何其他文字、不要用 markdown 代码块包裹）：
{
  "angerLevel": 1,        // 1-10 整数
  "trustLevel": 1,        // 1-10 整数
  "progressLevel": 1,     // 1-10 整数
  "analysis": "一句话分析（最多120字）",
  "goalUpdates": [{"goalId": "目标ID", "achieved": true, "reason": "理由"}],
  "npcEmotion": "neutral",          // happy/angry/sad/relaxed/neutral
  "npcEmotionIntensity": 0.5,       // 0.0-1.0
  "gesture": "none",                // nod/headTilt/none
  "suggestions": ["候选1", "候选2", "候选3"]
}"""


def build_scoring_prompt(
    user_message: str,
    previous_messages: list[dict],
    current_scores: dict[str, Any],
    goals: list[dict],
    language: str = "zh",
    scenario_description: str = "",
) -> str:
    """生成评分用提示词（中文），末尾附加 JSON 输出 schema。"""
    anger = current_scores.get("angerLevel", 1)
    trust = current_scores.get("trustLevel", 1)
    progress = current_scores.get("progressLevel", 1)

    history = format_conversation_history(previous_messages, language)
    goals_txt = format_goals(goals, language)
    scenario_ctx = f"\n场景背景: {scenario_description}\n" if scenario_description else ""

    return f"""你是销售对话评分引擎，请评估最新消息并更新分数。

当前分数: 愤怒={anger}/10, 信任={trust}/10, 进度={progress}/10
{scenario_ctx}
对话历史:
{history}

最新消息: {user_message}

目标:
{goals_txt}

目标判定规则:
- goalUpdates 的 goalId 请直接使用上方目标列表中 [ID: xxx] 标注的 ID
- 不要自行编造 ID，务必使用所提供的 ID
- goalUpdates 必须覆盖【所有】目标的最新状态；状态未变化的也请一并列出，achieved 保持上一轮的值（已达成目标可写 reason: "维持"）

「analysis」字段的规则:
- 只写 1～2 句简短的话（最多 120 字）
- 格式：「[分数变化原因]。[下一步行动建议]。」
- 示例：「寒暄得体，信任 +1。下次可更具体地介绍产品优势。」
- 禁止长篇说明、列表或标题
- 不要在 analysis 中重复分数或目标列表

NPC 情绪推断:
- 请根据对话语境推断 NPC 当前的情绪状态
- npcEmotion: "happy"、"angry"、"sad"、"relaxed"、"neutral" 之一
- npcEmotionIntensity: 0.0（非常弱）～ 1.0（非常强）
- 考虑要素: NPC 的性格、对话走向、用户态度、分数变化

NPC 手势推断:
- 请根据对话语境推断 NPC 合适的手势
- gesture: "nod"（点头）、"headTilt"（歪头）、"none"（无）之一
- 点头(nod): NPC 表示同意、理解或共情的场景使用
- 歪头(headTilt): NPC 表示疑问、困惑或思考的场景使用
- 无(none): 不需要特别手势的场景（默认）
- 不必每次都加手势，请以自然频率使用

回复建议（suggestions）:
- 请生成销售人员（用户）接下来可以说的回复建议
- 基于 NPC 上一条发言和对话走向
- 重要: 生成建议时要考虑场景背景和目标提示
- 优先提出有助于达成未完成目标的建议
- suggestions: 约 3 条简短回复候选的数组（每条最多 40 字）
- 各候选应具有不同方向（例如: 强势 / 共情 / 提问），使选择会改变指标
- 以销售人员实际会说的第一人称自然表达来写
- 不要加引号或编号

{SCORING_SCHEMA_HINT}"""


def format_conversation_history(messages: list[dict], language: str = "zh") -> str:
    """格式化对话历史（仅最近 5 条）。"""
    if not messages:
        return "（无历史）"

    lines = []
    for msg in messages[-5:]:
        sender = msg.get("sender", "")
        content = msg.get("content", "")
        label = "销售" if sender == "user" else "客户"
        lines.append(f"{label}: {content}")
    return "\n".join(lines)


def format_goals(goals: list[dict], language: str = "zh") -> str:
    """格式化目标（含 ID，供 LLM 返回准确 goalId；含未达成目标的判定标准与提示）。"""
    if not goals:
        return "（无目标）"

    lines = []
    for goal in goals:
        goal_id = goal.get("id", "")
        description = goal.get("description", "")
        achieved = goal.get("achieved", False)
        status = "已达成" if achieved else "未达成"
        lines.append(f"- [ID: {goal_id}] {description}: {status}")

        criteria = goal.get("criteria", [])
        if criteria and not achieved:
            lines.append(f"  达成标准: {'; '.join(criteria)}")
        hints = goal.get("hints", [])
        if hints and not achieved:
            lines.append(f"  提示: {'; '.join(hints)}")
    return "\n".join(lines)


def get_default_scores() -> dict[str, int]:
    return {"angerLevel": 1, "trustLevel": 1, "progressLevel": 1}
