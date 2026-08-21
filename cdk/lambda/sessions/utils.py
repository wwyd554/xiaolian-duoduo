"""
共通ユーティリティ関数

セッション管理Lambda関数で使用される共通の機能を提供します。
"""

import os
import boto3
from decimal import Decimal
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver

# ロガー設定
logger = Logger(service="sessions-utils")

# 環境変数
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')
SCENARIOS_TABLE = os.environ.get('SCENARIOS_TABLE')

# DynamoDB クライアント
dynamodb = boto3.resource('dynamodb')
sessions_table = None
messages_table = None
scenarios_table = None

def init_tables():
    """
    DynamoDBテーブルのリソースを初期化
    """
    global sessions_table, messages_table, scenarios_table
    
    if SESSIONS_TABLE:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
    
    if MESSAGES_TABLE:
        messages_table = dynamodb.Table(MESSAGES_TABLE)
        
    if SCENARIOS_TABLE:
        scenarios_table = dynamodb.Table(SCENARIOS_TABLE)

def get_user_id_from_event(app: APIGatewayRestResolver):
    """
    イベントからCognitoユーザーIDを抽出

    Args:
        app: APIGatewayRestResolverインスタンス

    Returns:
        str: ユーザーID
    """
    event = app.current_event
    try:
        # Cognitoからのユーザー情報を抽出
        claims = event.request_context.authorizer.claims
        user_id = claims.get('cognito:username', claims.get('sub', 'anonymous'))
        return user_id
    except (AttributeError, KeyError):
        logger.warning("ユーザーID取得失敗、匿名ユーザーとして処理します")
        return "anonymous"

def convert_decimal_to_json_serializable(obj):
    """
    DynamoDBのDecimal型をJSONシリアライズ可能な形式に変換する
    
    Args:
        obj: 変換対象のオブジェクト
        
    Returns:
        JSONシリアライズ可能なオブジェクト
    """
    if isinstance(obj, Decimal):
        # Decimalを適切な数値型に変換
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    elif isinstance(obj, dict):
        return {key: convert_decimal_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal_to_json_serializable(item) for item in obj]
    else:
        return obj

def convert_float_to_decimal(obj):
    """
    Float型をDynamoDB互換のDecimal型に変換する
    
    Args:
        obj: 変換対象のオブジェクト
        
    Returns:
        DynamoDB互換なオブジェクト
    """
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {key: convert_float_to_decimal(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_float_to_decimal(item) for item in obj]
    else:
        return obj

def create_message_item(session_id: str, user_id: str, message_id: str, content: str, 
                       sender: str, timestamp: int, expire_at: int, 
                       realtime_metrics: dict = None) -> dict:
    """
    メッセージアイテムを作成する
    
    Args:
        session_id: セッションID
        user_id: ユーザーID
        message_id: メッセージID
        content: メッセージ内容
        sender: 送信者（user/ai）
        timestamp: タイムスタンプ
        expire_at: 有効期限
        realtime_metrics: リアルタイム評価指標
        
    Returns:
        dict: DynamoDB用のメッセージアイテム
    """
    item = {
        'sessionId': session_id,
        'messageId': message_id,
        'userId': user_id,
        'content': content,
        'sender': sender,
        'timestamp': timestamp,
        'expireAt': expire_at
    }
    
    if realtime_metrics:
        # メトリクスをDecimal型に変換
        item['realtimeMetrics'] = convert_float_to_decimal(realtime_metrics)
    
    return item

def validate_message_data(data: dict) -> bool:
    """
    メッセージデータの妥当性を検証する
    
    Args:
        data: 検証対象のメッセージデータ
        
    Returns:
        bool: 妥当性の結果
    """
    required_fields = ['sessionId', 'messageId', 'userId', 'content', 'sender', 'timestamp']
    
    # 必須フィールドの存在確認
    for field in required_fields:
        if field not in data:
            logger.error(f"必須フィールドが不足しています: {field}")
            return False
    
    # senderの値確認
    if data['sender'] not in ['user', 'ai']:
        logger.error(f"不正なsender値: {data['sender']}")
        return False
    
    # realtimeMetricsの構造確認（存在する場合）
    if 'realtimeMetrics' in data:
        metrics = data['realtimeMetrics']
        required_metrics = ['angerLevel', 'trustLevel', 'progressLevel']
        
        for metric in required_metrics:
            if metric not in metrics:
                logger.error(f"必須メトリクスが不足しています: {metric}")
                return False
            
            # メトリクス値の範囲確認（0-100）
            value = metrics[metric]
            if not isinstance(value, (int, float, Decimal)) or value < 0 or value > 100:
                logger.error(f"メトリクス値が範囲外です: {metric}={value}")
                return False
    
    return True

def format_message_for_response(message_item: dict) -> dict:
    """
    DynamoDBのメッセージアイテムをレスポンス用にフォーマットする
    
    Args:
        message_item: DynamoDBから取得したメッセージアイテム
        
    Returns:
        dict: レスポンス用にフォーマットされたメッセージ
    """
    # Decimal型をJSONシリアライズ可能な形式に変換
    formatted_item = convert_decimal_to_json_serializable(message_item)
    
    # 不要なフィールドを除外（必要に応じて）
    response_item = {
        'sessionId': formatted_item.get('sessionId'),
        'messageId': formatted_item.get('messageId'),
        'userId': formatted_item.get('userId'),
        'content': formatted_item.get('content'),
        'sender': formatted_item.get('sender'),
        'timestamp': formatted_item.get('timestamp'),
        'realtimeMetrics': formatted_item.get('realtimeMetrics')
    }
    
    # Noneの値を除外
    return {k: v for k, v in response_item.items() if v is not None}

def calculate_ttl(hours: int = 24) -> int:
    """
    TTL（Time To Live）を計算する
    
    Args:
        hours: 有効期限（時間）
        
    Returns:
        int: Unix timestamp
    """
    import time
    return int(time.time()) + (hours * 3600)

# テーブルの初期化
init_tables()