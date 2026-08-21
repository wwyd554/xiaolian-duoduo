"""
メッセージ関連のAPIハンドラー

メッセージ履歴取得などの機能を提供します。
"""

import json
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.event_handler.exceptions import (
    InternalServerError, NotFoundError, BadRequestError
)

from utils import get_user_id_from_event, sessions_table, messages_table, MESSAGES_TABLE

# ロガー設定
logger = Logger(service="message-handlers")

def register_message_routes(app: APIGatewayRestResolver):
    """
    メッセージ関連のルートを登録
    
    Args:
        app: APIGatewayRestResolverインスタンス
    """
    
    @app.get("/sessions/<session_id>/messages")
    def get_session_messages(session_id: str):
        """
        特定のセッションのメッセージ履歴を取得（元の機能のまま）

        Args:
            session_id (str): セッションID
            
        クエリパラメータ:
        - limit: 取得する最大件数 (デフォルト: 50)
        - nextToken: 次ページのトークン

        Returns:
            dict: メッセージ履歴リストと次ページトークン
        """
        try:
            # ユーザーIDを取得
            user_id = get_user_id_from_event(app)
            
            logger.debug("メッセージ履歴取得開始", extra={
                "session_id": session_id,
                "user_id": user_id
            })
            
            # パラメータのバリデーション
            if not session_id:
                raise BadRequestError("セッションIDが指定されていません")
            
            # クエリパラメータ
            query_params = app.current_event.query_string_parameters or {}
            limit = int(query_params.get('limit', 50))
            next_token = query_params.get('nextToken')
            
            logger.debug("クエリパラメータ解析完了", extra={
                "session_id": session_id,
                "limit": limit,
                "has_next_token": bool(next_token)
            })
            
            # クエリパラメータのバリデーション
            if limit < 1 or limit > 100:
                limit = 50  # デフォルト値に設定
            
            # まずセッションが存在し、このユーザーのものであることを確認
            if sessions_table:
                session_response = sessions_table.get_item(
                    Key={
                        'userId': user_id,
                        'sessionId': session_id
                    }
                )
                
                if 'Item' not in session_response:
                    raise NotFoundError(f"セッションが見つかりません: {session_id}")
            
            # メッセージ履歴を取得
            if messages_table:
                # クエリ実行用のパラメータ
                query_params = {
                    'KeyConditionExpression': 'sessionId = :sid',
                    'ExpressionAttributeValues': {
                        ':sid': session_id
                    },
                    'Limit': limit,
                    'ScanIndexForward': True  # 昇順（古いメッセージから）
                }
                
                # ページネーショントークンの追加
                if next_token:
                    query_params['ExclusiveStartKey'] = json.loads(next_token)
                
                # DynamoDBクエリの実行
                response = messages_table.query(**query_params)
                
                # レスポンス用のメッセージリストを作成
                messages = []
        
                for item in response.get('Items', []):
                    # レスポンス用に必要なフィールドだけを抽出
                    message = {
                        'messageId': item.get('messageId'),
                        'sessionId': item.get('sessionId'),
                        'timestamp': item.get('timestamp'),
                        'sender': item.get('sender'),
                        'content': item.get('content')
                    }
                    
                    # リアルタイムメトリクスがあれば追加
                    if 'realtimeMetrics' in item:
                        message['realtimeMetrics'] = item['realtimeMetrics']
                    
                    # 音声URLがあれば追加
                    if 'audioUrl' in item:
                        message['audioUrl'] = item['audioUrl']
                    
                    # 既存のKnowledge Base評価結果があれば追加
                    if 'knowledgeEvaluation' in item:
                        message['knowledgeEvaluation'] = item['knowledgeEvaluation']
                    
                    messages.append(message)
                
                # 次ページのトークン
                next_token = None
                if 'LastEvaluatedKey' in response:
                    next_token = json.dumps(response['LastEvaluatedKey'])
                
                logger.debug("メッセージ履歴取得完了", extra={
                    "session_id": session_id,
                    "messages_count": len(messages),
                    "has_next_token": bool(next_token)
                })
                
                return {
                    'success': True,
                    'messages': messages,
                    'nextToken': next_token
                }
            else:
                logger.error("メッセージテーブル未定義", extra={
                    "table_name": MESSAGES_TABLE,
                    "session_id": session_id
                })
                raise InternalServerError("システムエラーが発生しました")
        
        except NotFoundError:
            raise
        except BadRequestError:
            raise
        except Exception as e:
            logger.exception("メッセージ履歴取得エラー", extra={"error": str(e), "session_id": session_id})
            raise InternalServerError(f"メッセージ履歴の取得中にエラーが発生しました: {str(e)}")