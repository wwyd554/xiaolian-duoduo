"""
NPC会話エージェント - AgentCore Runtime版

NPCとの会話応答を生成するエージェント。
Strands AgentsとBedrock Claude 4.5 Haikuを使用して応答を生成する。

会話履歴はAgentCore Memory APIで手動管理する。
Session Managerはマルチモーダルメッセージを保存できないため使用しない。
スライド画像はS3から取得してマルチモーダルで送信し、
Memoryにはテキスト+スライドメタデータのみ保存する。
"""

import json
import os
import logging
import time
import boto3
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, Request

from strands import Agent
from strands.models import BedrockModel

from prompts import build_npc_system_prompt, get_default_npc_info, get_default_emotion_params

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', os.environ.get('AWS_DEFAULT_REGION', 'us-west-2'))
BEDROCK_MODEL = os.environ.get('BEDROCK_MODEL_CONVERSATION', 'global.anthropic.claude-haiku-4-5-20251001-v1:0')
AGENTCORE_MEMORY_ID = os.environ.get('AGENTCORE_MEMORY_ID', '')
SLIDE_BUCKET = os.environ.get('SLIDE_BUCKET', '')

app = FastAPI(title="NPC Conversation Agent", version="1.0.0")

# AgentCore Memoryクライアント（起動時に1回だけ初期化）
ac_client = boto3.client('bedrock-agentcore', region_name=AWS_REGION) if AGENTCORE_MEMORY_ID else None
s3_client = boto3.client('s3') if SLIDE_BUCKET else None


# ========================================
# AgentCore Memory 手動管理
# ========================================

def load_conversation_history(session_id: str, actor_id: str) -> List[Dict]:
    """AgentCore Memoryから会話履歴を復元（Strands Agentsのmessages形式）"""
    if not ac_client or not AGENTCORE_MEMORY_ID:
        return []
    try:
        resp = ac_client.list_events(
            memoryId=AGENTCORE_MEMORY_ID, actorId=actor_id, sessionId=session_id
        )
        messages = []
        for ev in reversed(resp.get('events', [])):  # 古い順に
            for p in ev.get('payload', []):
                if 'conversational' in p:
                    role = p['conversational']['role'].lower()
                    text = p['conversational'].get('content', {}).get('text', '')
                    if text:
                        messages.append({'role': role, 'content': [{'text': text}]})
        logger.info(f"Loaded {len(messages)} messages from Memory")
        return messages
    except Exception as e:
        logger.warning(f"Failed to load conversation history: {e}")
        return []


def save_conversation_event(session_id: str, actor_id: str, role: str, text: str,
                            slide_pages: List[int] = None) -> bool:
    """会話イベントをAgentCore Memoryに保存（スライドメタデータ付き）

    Returns:
        bool: 保存成功時True、失敗またはMemory無効時False
    """
    if not ac_client or not AGENTCORE_MEMORY_ID:
        return False
    try:
        kwargs = dict(
            memoryId=AGENTCORE_MEMORY_ID,
            actorId=actor_id,
            sessionId=session_id,
            eventTimestamp=time.time(),
            payload=[{'conversational': {'content': {'text': text}, 'role': role}}],
        )
        if slide_pages:
            kwargs['metadata'] = {
                'eventType': {'stringValue': 'slide_presentation'},
                'presentedSlides': {'stringValue': ' '.join(str(p) for p in slide_pages)},
            }
        ac_client.create_event(**kwargs)
        logger.info(f"Saved {role} event to Memory" + (f" (slides: {slide_pages})" if slide_pages else ""))
        return True
    except Exception as e:
        logger.warning(f"Failed to save event to Memory: {e}")
        return False


# ========================================
# マルチモーダルメッセージ構築
# ========================================

# スライド送信の上限定数
MAX_SLIDES_PER_MESSAGE = 5       # 同時送信スライド数の上限
MAX_IMAGE_SIZE = 5 * 1024 * 1024          # 1画像あたり5MB上限
MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024  # 合計15MB上限


def build_multimodal_message(user_message: str, presented_slides: list) -> list:
    """スライド画像付きマルチモーダルメッセージを構築（S3から取得）

    上限チェック:
      - 同時送信スライド数: MAX_SLIDES_PER_MESSAGE
      - 1画像あたりサイズ: MAX_IMAGE_SIZE
      - 合計画像サイズ: MAX_TOTAL_IMAGE_BYTES
    超過時はwarningログを出してスキップし、テキストラベルのみ追加する。
    """
    content_blocks = []
    # スライド数を上限でスライス
    slides_to_process = presented_slides[:MAX_SLIDES_PER_MESSAGE]
    if len(presented_slides) > MAX_SLIDES_PER_MESSAGE:
        logger.warning(
            f"スライド数が上限を超過: {len(presented_slides)} > {MAX_SLIDES_PER_MESSAGE}, "
            f"先頭{MAX_SLIDES_PER_MESSAGE}枚のみ処理"
        )

    total_image_bytes = 0
    if s3_client and SLIDE_BUCKET:
        for slide in slides_to_process:
            page_number = slide.get('pageNumber', '?')
            image_key = slide.get('imageKey', '')
            if image_key:
                try:
                    resp = s3_client.get_object(Bucket=SLIDE_BUCKET, Key=image_key)
                    image_bytes = resp['Body'].read()
                    image_size = len(image_bytes)

                    # 1画像あたりのサイズ上限チェック
                    if image_size > MAX_IMAGE_SIZE:
                        logger.warning(
                            f"スライド{page_number}の画像サイズが上限超過: "
                            f"{image_size} bytes > {MAX_IMAGE_SIZE} bytes, スキップ"
                        )
                        content_blocks.append({'text': f'[スライド{page_number} - 画像サイズ超過のためスキップ]'})
                        continue

                    # 合計画像サイズの上限チェック
                    if total_image_bytes + image_size > MAX_TOTAL_IMAGE_BYTES:
                        logger.warning(
                            f"スライド{page_number}追加で合計画像サイズが上限超過: "
                            f"{total_image_bytes + image_size} bytes > {MAX_TOTAL_IMAGE_BYTES} bytes, スキップ"
                        )
                        content_blocks.append({'text': f'[スライド{page_number} - 合計サイズ超過のためスキップ]'})
                        continue

                    content_blocks.append({
                        'image': {'format': 'png', 'source': {'bytes': image_bytes}}
                    })
                    content_blocks.append({'text': f'[スライド{page_number}]'})
                    total_image_bytes += image_size
                    logger.info(f"Slide {page_number} loaded ({image_size} bytes, total: {total_image_bytes} bytes)")
                except Exception as e:
                    logger.warning(f"Slide {page_number} load failed: {e}")
    content_blocks.append({'text': user_message})
    return content_blocks


# ========================================
# レスポンス抽出
# ========================================

def extract_response_text(result) -> str:
    """Strands Agentsのレスポンスからテキストを抽出"""
    if hasattr(result, 'message'):
        msg = result.message
        if isinstance(msg, str):
            return msg
        elif isinstance(msg, dict) and 'content' in msg:
            content = msg['content']
            if isinstance(content, list):
                return ''.join(
                    item.get('text', '') if isinstance(item, dict) else str(item)
                    for item in content
                )
            return str(content)
        elif hasattr(msg, 'content'):
            content = msg.content
            if isinstance(content, list):
                return ''.join(
                    item.get('text', '') if isinstance(item, dict) else str(item)
                    for item in content
                )
            return str(content)
        return str(msg)
    return str(result)


# ========================================
# メイン処理
# ========================================

def handle_invocation(payload: Dict[str, Any]) -> Dict[str, Any]:
    """エージェント呼び出しを処理"""
    try:
        logger.info("NPC会話エージェント呼び出し")

        user_message = payload.get('message', 'こんにちは')
        npc_info = payload.get('npcInfo', get_default_npc_info())
        emotion_params = payload.get('emotionParams', get_default_emotion_params())
        language = payload.get('language', 'zh')
        session_id = payload.get('sessionId', '')
        actor_id = payload.get('actorId', payload.get('userId', 'default_user'))
        presented_slides = payload.get('presentedSlides', [])

        logger.info(f"Session: {session_id}, Actor: {actor_id}, Message: {user_message[:50]}..., Slides: {len(presented_slides)}")

        # システムプロンプト生成（スライドコンテキスト含む）
        system_prompt = build_npc_system_prompt(
            npc_info=npc_info,
            emotion_params=emotion_params,
            language=language,
            presented_slides=presented_slides
        )

        # 会話履歴をAgentCore Memoryから手動復元
        history = load_conversation_history(session_id, actor_id)

        # エージェント作成（Session Managerなし、会話履歴はmessagesで渡す）
        model = BedrockModel(
            model_id=BEDROCK_MODEL,
            region_name=AWS_REGION,
            temperature=0.7,
            max_tokens=500,
        )
        agent = Agent(model=model, system_prompt=system_prompt, messages=history)

        # メッセージ送信
        if presented_slides:
            try:
                message_content = build_multimodal_message(user_message, presented_slides)
                logger.info(f"Sending multimodal message with {len(presented_slides)} slides")
                result = agent(message_content)
            except Exception as mm_error:
                logger.warning(f"Multimodal failed, falling back to text: {mm_error}")
                result = agent(user_message)
        else:
            logger.info(f"Sending text message: {user_message}")
            result = agent(user_message)

        npc_response = extract_response_text(result)
        logger.info(f"NPC応答生成完了: {len(npc_response)}文字")

        # AgentCore Memoryに手動保存（テキスト+スライドメタデータ）
        slide_pages = [s.get('pageNumber') for s in presented_slides] if presented_slides else None
        memory_enabled = bool(AGENTCORE_MEMORY_ID)

        if memory_enabled:
            user_saved = save_conversation_event(session_id, actor_id, 'USER', user_message, slide_pages)
            assistant_saved = save_conversation_event(session_id, actor_id, 'ASSISTANT', npc_response)
            # 両方成功: 'ok', 片方以上失敗: 'partial_failure'
            memory_sync_status = 'ok' if (user_saved and assistant_saved) else 'partial_failure'
        else:
            memory_sync_status = 'disabled'

        return {
            'success': True,
            'message': npc_response,
            'sessionId': session_id,
            'memoryEnabled': memory_enabled,
            'memorySyncStatus': memory_sync_status,
        }

    except Exception as e:
        logger.error(f"NPC会話エージェントエラー: {e}", exc_info=True)
        return {
            'success': False,
            'error': 'AGENT_ERROR',
            'message': '会話処理中にエラーが発生しました'
        }


@app.post("/invocations")
async def invoke_agent(request: Request):
    """AgentCore Runtime呼び出しエンドポイント"""
    try:
        raw_body = await request.body()
        try:
            body = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            body = {}

        if isinstance(body, dict):
            if 'input' in body:
                payload = body['input']
            elif 'body' in body:
                payload = body['body']
            else:
                payload = body
        else:
            payload = {}

        logger.info(f"処理ペイロード: {json.dumps(payload, ensure_ascii=False, default=str)[:500]}")
        result = handle_invocation(payload)
        return {"output": result}
    except Exception as e:
        logger.error(f"Invocation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/ping")
async def ping():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy", "memoryId": AGENTCORE_MEMORY_ID or "not_configured"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
