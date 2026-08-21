"""
動画分析エージェント用プロンプト定義
"""

from typing import Dict, Any


def get_video_analysis_prompt(language: str) -> str:
    """获取视频分析用提示词"""
    if language == 'en':
        return """Analyze this sales roleplay video recording and evaluate the salesperson's performance.

Focus on:
1. Eye contact and gaze direction
2. Facial expressions and emotions
3. Body language and gestures
4. Overall presentation and confidence

Provide your analysis in the following JSON format only (scores are 1-10):

{
  "overallScore": <1-10>,
  "eyeContact": <1-10>,
  "facialExpression": <1-10>,
  "gesture": <1-10>,
  "emotion": <1-10>,
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "analysis": "Overall assessment of non-verbal communication"
}

Respond ONLY with the JSON object."""
    elif language == 'zh':
        return """请分析这段销售角色扮演的录制视频，并评估销售人员的表现。

请关注以下几点：
1. 眼神接触与视线方向
2. 表情与情感表达
3. 肢体语言与手势
4. 整体呈现与自信程度

请仅以如下 JSON 格式提供分析结果（分数为 1-10 分）：

{
  "overallScore": <1-10 的综合分数>,
  "eyeContact": <1-10>,
  "facialExpression": <1-10>,
  "gesture": <1-10>,
  "emotion": <1-10>,
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进点1", "改进点2"],
  "analysis": "非语言沟通的综合评价"
}

只返回 JSON 对象。"""
    else:
        return """この営業ロールプレイの録画動画を分析し、営業担当者のパフォーマンスを評価してください。

以下の点に注目してください：
1. アイコンタクトと視線の方向
2. 表情と感情表現
3. ボディランゲージとジェスチャー
4. 全体的なプレゼンテーションと自信

以下のJSON形式のみで分析結果を提供してください（スコアは1-10点）：

{
  "overallScore": <1-10の総合スコア>,
  "eyeContact": <1-10>,
  "facialExpression": <1-10>,
  "gesture": <1-10>,
  "emotion": <1-10>,
  "strengths": ["強み1", "強み2"],
  "improvements": ["改善点1", "改善点2"],
  "analysis": "非言語コミュニケーションの総合評価"
}

JSONオブジェクトのみを返してください。"""


def create_default_video_analysis(language: str) -> Dict[str, Any]:
    """创建默认视频分析结果"""
    if language == 'en':
        return {
            "overallScore": 5,
            "eyeContact": 5,
            "facialExpression": 5,
            "gesture": 5,
            "emotion": 5,
            "strengths": ["Analysis in progress"],
            "improvements": ["Analysis in progress"],
            "analysis": "Video analysis encountered an issue."
        }
    elif language == 'zh':
        return {
            "overallScore": 5,
            "eyeContact": 5,
            "facialExpression": 5,
            "gesture": 5,
            "emotion": 5,
            "strengths": ["分析中"],
            "improvements": ["分析中"],
            "analysis": "视频分析时出现问题。"
        }
    else:
        return {
            "overallScore": 5,
            "eyeContact": 5,
            "facialExpression": 5,
            "gesture": 5,
            "emotion": 5,
            "strengths": ["分析中"],
            "improvements": ["分析中"],
            "analysis": "動画分析中に問題が発生しました。"
        }
