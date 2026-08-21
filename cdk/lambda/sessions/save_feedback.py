import os
import boto3
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Attr
from aws_lambda_powertools import Logger

# 環境変数の取得
SESSION_FEEDBACK_TABLE = os.environ.get('SESSION_FEEDBACK_TABLE', 'dev-AISalesRolePlay-SessionFeedback')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE', 'dev-AISalesRolePlay-Sessions')
MESSAGE_TTL_DAYS = int(os.environ.get('MESSAGE_TTL_DAYS', '180'))  # デフォルト180日

# DynamoDBリソースの初期化
dynamodb = boto3.resource('dynamodb')
logger = Logger(service="sessions-api")

def save_feedback_to_dynamodb(session_id, feedback_data, final_metrics, messages, goal_data=None, user_id=None):
    """
    フィードバックデータをDynamoDBに保存する関数
    
    Args:
        session_id (str): セッションID
        feedback_data (dict): フィードバックデータ
        final_metrics (dict): 最終メトリクスデータ
        messages (list): メッセージ履歴
        goal_data (dict): ゴール達成状況データ
        user_id (str): ユーザーID（オプション）
    
    Returns:
        bool: 保存成功時はTrue、失敗時はFalse
    """
    try:
        # フィードバックデータ保存用のテーブル
        feedback_table = dynamodb.Table(SESSION_FEEDBACK_TABLE)
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # セッション情報を取得してシナリオIDを確認
        session_info = None
        scenario_id = ""
        
        try:
            # セッション情報の取得
            if user_id:
                # ユーザーIDとセッションIDがある場合は直接取得
                session_response = sessions_table.get_item(
                    Key={
                        'userId': user_id,
                        'sessionId': session_id
                    }
                )
                if 'Item' in session_response:
                    session_info = session_response['Item']
            
            # 直接取得できない場合はスキャンを試みる
            if not session_info:
                session_response = sessions_table.scan(
                    FilterExpression=Attr('sessionId').eq(session_id)
                )
                
                session_items = session_response.get('Items', [])
                if session_items:
                    session_info = session_items[0]
                    # ユーザーIDが渡されていない場合は取得して保存
                    if not user_id and 'userId' in session_info:
                        user_id = session_info['userId']
        except Exception as e:
            logger.warning(f"セッション情報取得エラー: {str(e)}")
        
        # シナリオIDを取得
        if session_info and 'scenarioId' in session_info:
            scenario_id = session_info['scenarioId']
            
        # スコアを数値に変換
        overall_score = 0
        if feedback_data and "scores" in feedback_data:
            try:
                overall_score = int(float(feedback_data["scores"].get("overall", 0)) * 10)
            except (ValueError, TypeError):
                overall_score = 0
                
        # 現在のタイムスタンプ
        current_time = datetime.utcnow().isoformat() + 'Z'
        
        # TTL設定（デフォルト180日）
        ttl = int((datetime.utcnow() + timedelta(days=MESSAGE_TTL_DAYS)).timestamp())
        
        # フィードバックアイテムの作成
        feedback_item = {
            "sessionId": session_id,
            "createdAt": current_time,      # 作成日時（ISOフォーマット）
            "dataType": "final-feedback",   # データタイプ識別子
            "feedbackData": feedback_data,
            "finalMetrics": final_metrics,
            "messageCount": len(messages) if messages else 0,
            "timestamp": current_time,
            "expireAt": ttl,
            "scenarioId": scenario_id,      # シナリオIDを追加（GSI用）
            "overallScore": overall_score   # 総合スコアを追加（GSI用）
        }
        
        # ユーザーIDがある場合は追加
        if user_id:
            feedback_item["userId"] = user_id
        
        # ゴール結果データがある場合は追加
        if goal_data:
            feedback_item["goalResults"] = goal_data
        
        # DynamoDBに保存
        feedback_table.put_item(Item=feedback_item)
        
        logger.info(f"フィードバックデータの保存が完了しました: sessionId={session_id}, scenarioId={scenario_id}, overallScore={overall_score}")
        
        return True
        
    except Exception as e:
        logger.error(f"フィードバックデータの保存に失敗しました: {str(e)}")
        return False
