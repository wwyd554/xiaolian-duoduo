import json
import boto3
import time
from decimal import Decimal
from typing import Dict, Any, List, Optional
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, CORSConfig
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext

# リアルタイムスコアリングモジュールをインポート
from realtime_scoring import calculate_realtime_scores
# コンプライアンスチェックモジュールをインポート
from compliance_check import check_compliance_violations

# Powertools 設定
logger = Logger(service="scoring-api")

# CORS設定 - 開発環境では全てのオリジンを許可
cors_config = CORSConfig(
    allow_origin="*",  # 本番環境では特定のドメインに限定
    max_age=300,
    allow_headers=["Content-Type", "Authorization", "X-Api-Key", "X-Amz-Security-Token", "X-Amz-Date"],
    allow_credentials=True  # 認証情報を許可
)

# API Gateway REST Resolver
app = APIGatewayRestResolver(cors=cors_config)

# Bedrockクライアント初期化
bedrock_runtime = boto3.client('bedrock-runtime')

@app.post("/scoring/realtime")
def handle_realtime_scoring():
    """
    リアルタイムスコアリングAPIエンドポイント
    ユーザーの発言をリアルタイムで評価し、11パラメータのスコアを計算
    オプションでコンプライアンスチェックも実行可能
    """
    try:
        # リクエストボディのパース
        request_body = app.current_event.json_body or {}
        
        # リクエストボディが文字列の場合はJSONとしてパース
        if isinstance(request_body, str):
            try:
                request_body = json.loads(request_body)
            except json.JSONDecodeError:
                logger.error("リクエストボディをJSONとしてパースできませんでした", extra={"request_body": request_body})
                request_body = {}
        
        logger.info("Processing realtime scoring request", extra={
            "request_body_keys": list(request_body.keys()) if request_body else None
        })
        
        # 必要なデータの抽出
        user_message = request_body.get('message', '')
        previous_messages = request_body.get('previousMessages', [])
        session_id = request_body.get('sessionId', '')  # セッションIDを追加
        
        # ゴール関連データの抽出
        scenario_goals = request_body.get('goals', [])
        current_goal_statuses = request_body.get('goalStatuses', [])
        
        # コンプライアンスチェックフラグとシナリオIDの抽出
        compliance_check_enabled = request_body.get('complianceCheck', True)  # デフォルトで有効
        scenario_id = request_body.get('scenarioId', '')
        
        logger.info("Goal data received", extra={
            "has_goals": bool(scenario_goals),
            "goals_count": len(scenario_goals),
            "has_goal_statuses": bool(current_goal_statuses),
            "goal_statuses_count": len(current_goal_statuses),
            "compliance_check_enabled": compliance_check_enabled,
            "scenario_id": scenario_id,
            "session_id": session_id
        })
        
        # バリデーション
        if not user_message:
            from aws_lambda_powertools.event_handler.exceptions import BadRequestError
            raise BadRequestError("ユーザーメッセージは必須です")
        
        if not session_id:
            from aws_lambda_powertools.event_handler.exceptions import BadRequestError
            raise BadRequestError("セッションIDは必須です")
        
        # 言語設定を取得（デフォルトはja）
        language = request_body.get('language', 'zh')
        
        # リアルタイムスコアリングの実行
        start_time = time.time()
        scores = calculate_realtime_scores(
            user_message, 
            previous_messages, 
            None,  # sessionIdは不要
            scenario_goals,
            current_goal_statuses,
            language  # 言語パラメータを追加
        )
        processing_time = time.time() - start_time
        
        # ゴールステータスがあればレスポンスに含める
        response_data = {
            "success": True,
            "scores": scores
        }
        
        goal_statuses_result = None
        if "goalStatuses" in scores:
            # ゴールステータスを別のオブジェクトとして返す
            goal_statuses_result = scores.pop("goalStatuses")
            response_data["goal"] = {
                "statuses": goal_statuses_result
            }
            
            logger.info("Goal statuses included in response", extra={
                "goal_statuses_count": len(goal_statuses_result)
            })
        
        # リアルタイムメトリクスをDynamoDBに保存
        metrics_data = {
            "angerLevel": scores.get("angerLevel", 0),
            "trustLevel": scores.get("trustLevel", 0),
            "progressLevel": scores.get("progressLevel", 0),
            "analysis": scores.get("analysis", ""),
            "userMessage": user_message,
            "messageCount": len(previous_messages) + 1
        }
        
        # ゴール情報も含める
        if goal_statuses_result:
            metrics_data["goalStatuses"] = goal_statuses_result
            metrics_data["goalScore"] = calculate_goal_score_from_statuses(goal_statuses_result, scenario_goals)
        
        # コンプライアンスチェックが有効な場合は実行
        compliance_result = None
        if compliance_check_enabled:
            try:
                logger.info("Running compliance check", extra={
                    "session_id": session_id,
                    "message_length": len(user_message),
                    "scenario_id": scenario_id
                })
                
                # コンプライアンスチェック実行
                compliance_start_time = time.time()
                # 言語設定を取得（デフォルトはja）
                language = request_body.get('language', 'zh')
                compliance_result = check_compliance_violations([user_message], session_id, scenario_id, None, language)
                compliance_processing_time = time.time() - compliance_start_time
                
                # コンプライアンス結果をレスポンスに追加
                response_data["compliance"] = {
                    "score": compliance_result["complianceScore"],
                    "violations": compliance_result["violations"],
                    "analysis": compliance_result["analysis"],
                    "processingTimeMs": int(compliance_processing_time * 1000)
                }
                
                logger.info("Compliance check completed", extra={
                    "session_id": session_id,
                    "processing_time_ms": int(compliance_processing_time * 1000),
                    "compliance_score": compliance_result["complianceScore"],
                    "violations_count": len(compliance_result["violations"])
                })
                
            except Exception as compliance_error:
                logger.error("Error in compliance check", extra={
                    "error": str(compliance_error)
                })
                
                # エラー時のフォールバック結果を返す
                response_data["compliance"] = {
                    "score": 100,  # デフォルトスコア
                    "violations": [],
                    "analysis": f"コンプライアンスチェック中にエラーが発生しました: {str(compliance_error)}",
                    "error": str(compliance_error)
                }
        
        # DynamoDBに一括保存（メトリクス + コンプライアンス結果）
        save_realtime_metrics_to_dynamodb(session_id, metrics_data, compliance_result)
        
        logger.info("Realtime scoring completed", extra={
            "processing_time_ms": int(processing_time * 1000),
            "anger_level": scores.get("angerLevel"),
            "trust_level": scores.get("trustLevel"),
            "progress_level": scores.get("progressLevel"),
            "has_goal_data": "goal" in response_data,
            "has_compliance_data": "compliance" in response_data,
            "session_id": session_id
        })
        
        response_data["processingTimeMs"] = int(processing_time * 1000)
        return response_data
        
    except Exception as error:
        logger.exception("Unexpected error in realtime scoring handler", extra={
            "error": str(error)
        })
        from aws_lambda_powertools.event_handler.exceptions import InternalServerError
        raise InternalServerError(f"リアルタイムスコアリング中にエラーが発生しました: {str(error)}")

# DynamoDBにフィードバックデータを保存する関数
def save_feedback_to_dynamodb(session_id: str, feedback_data: Dict[str, Any], final_metrics: Dict[str, Any], messages: List[Dict[str, Any]], goal_data: Optional[Dict[str, Any]] = None) -> bool:
    """
    フィードバックデータを固定キーで保存（更新ベース）
    
    Args:
        session_id: セッションID
        feedback_data: フィードバック分析結果
        final_metrics: 最終メトリクス
        messages: 会話履歴
        goal_data: ゴール関連データ（オプション）
        
    Returns:
        bool: 保存が成功した場合はTrue、それ以外はFalse
    """
    try:
        # DynamoDBクライアントの初期化
        dynamodb = boto3.resource('dynamodb')
        
        # 環境変数からテーブル名を取得
        import os
        table_name = os.environ.get('SESSION_FEEDBACK_TABLE')
        
        table = dynamodb.Table(table_name)
        
        # TTLの設定（180日後に自動削除）
        ttl = int(time.time()) + (180 * 24 * 60 * 60)
        current_timestamp = time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        # 保存するデータを作成（固定ソートキーを使用）
        item = {
            "sessionId": session_id,
            "createdAt": current_timestamp,  # タイムスタンプをソートキーとして使用
            "dataType": "final-feedback",
            "feedbackData": feedback_data,
            "finalMetrics": final_metrics,
            "messageCount": len(messages),
            "updatedAt": current_timestamp,  # 実際の更新時刻
            "expireAt": ttl
        }
        
        # ゴールデータがある場合は追加
        if goal_data:
            item["goalResults"] = goal_data
            logger.info("ゴールデータも含めて保存します", extra={
                "session_id": session_id,
                "goal_score": goal_data.get("goalScore", 0),
                "goal_statuses_count": len(goal_data.get("goalStatuses", []))
            })
        
        # DynamoDBに保存（既存があれば上書き）
        table.put_item(Item=item)
        
        logger.info("フィードバックデータを固定キーで保存しました", extra={
            "session_id": session_id,
            "overall_score": feedback_data.get("scores", {}).get("overall"),
            "message_count": len(messages),
            "has_goal_data": bool(goal_data),
            "updated_at": current_timestamp
        })
        return True
        
    except Exception as e:
        logger.error("フィードバックデータの保存に失敗しました", extra={
            "error": str(e),
            "session_id": session_id
        })
        return False

# DynamoDBにメトリクスデータを保存する関数
def save_metrics_to_dynamodb(session_id: str, metrics: Dict[str, Any]) -> bool:
    """
    メトリクスデータをDynamoDBに保存（SessionFeedbackテーブル構造に適合）
    
    Args:
        session_id: セッションID
        metrics: メトリクスデータ
        
    Returns:
        bool: 保存が成功した場合はTrue、それ以外はFalse
    """
    try:
        # DynamoDBクライアントの初期化
        dynamodb = boto3.resource('dynamodb')
        
        # 環境変数からテーブル名を取得
        import os
        table_name = os.environ.get('SESSION_FEEDBACK_TABLE')
        
        table = dynamodb.Table(table_name)
        
        # TTLの設定（24時間後に自動削除）
        ttl = int(time.time()) + 86400
        
        # 現在時刻のISO形式文字列を作成（ソートキーとして使用）
        created_at = time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        # SessionFeedbackテーブル構造に適合したアイテムの作成
        item = {
            "sessionId": session_id,
            "createdAt": created_at,  # ソートキー
            "dataType": "metrics",  # データタイプを識別
            "metricsData": metrics,  # メトリクスデータ
            "expireAt": ttl
        }
        
        # DynamoDBに保存
        table.put_item(Item=item)
        
        logger.info("メトリクスデータをDynamoDBに保存しました", extra={
            "session_id": session_id,
            "anger_level": metrics.get("angerLevel"),
            "trust_level": metrics.get("trustLevel"),
            "progress_level": metrics.get("progressLevel")
        })
        return True
        
    except Exception as e:
        logger.error("メトリクスデータの保存に失敗しました", extra={
            "error": str(e),
            "session_id": session_id
        })
        return False

def get_feedback_from_dynamodb(session_id: str) -> Optional[Dict[str, Any]]:
    """
    フィードバックデータをDynamoDBから取得
    
    Args:
        session_id: セッションID
        
    Returns:
        Optional[Dict[str, Any]]: フィードバックデータ（存在しない場合はNone）
    """
    try:
        # DynamoDBクライアントの初期化
        dynamodb = boto3.resource('dynamodb')
        
        # 環境変数からテーブル名を取得
        import os
        table_name = os.environ.get('SESSION_FEEDBACK_TABLE')
        
        table = dynamodb.Table(table_name)
        
        # セッションIDで最新のフィードバックを取得（降順でソート）
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('sessionId').eq(session_id),
            ScanIndexForward=False,  # 降順ソート（最新が先頭）
            Limit=1
        )
        
        items = response.get('Items', [])
        
        if not items:
            logger.info("フィードバックデータが見つかりません", extra={
                "session_id": session_id
            })
            return None
        
        feedback_item = items[0]
        
        logger.info("フィードバックデータを取得しました", extra={
            "session_id": session_id,
            "created_at": feedback_item.get("createdAt"),
            "overall_score": feedback_item.get("feedbackData", {}).get("scores", {}).get("overall")
        })
        
        return feedback_item
        
    except Exception as e:
        logger.error("フィードバックデータの取得に失敗しました", extra={
            "error": str(e),
            "session_id": session_id
        })
        return None

# DynamoDBにリアルタイムメトリクスデータを保存する関数
def save_realtime_metrics_to_dynamodb(session_id: str, metrics_data: Dict[str, Any], compliance_result: Optional[Dict[str, Any]] = None) -> bool:
    """
    リアルタイムメトリクスデータを個別レコードとして保存
    各メッセージごとに1つのレコードを作成し、メッセージ履歴として管理
    オプションでコンプライアンス結果も同時に保存
    
    Args:
        session_id: セッションID
        metrics_data: メトリクスデータ
        compliance_result: コンプライアンスチェック結果（オプション）
        
    Returns:
        bool: 保存が成功した場合はTrue、それ以外はFalse
    """
    try:
        # DynamoDBクライアントの初期化
        dynamodb = boto3.resource('dynamodb')
        
        # 環境変数からテーブル名を取得
        import os
        table_name = os.environ.get('SESSION_FEEDBACK_TABLE')
        
        table = dynamodb.Table(table_name)
        
        # TTLの設定（180日後に自動削除）
        ttl = int(time.time()) + (180 * 24 * 60 * 60)
        current_timestamp = time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        
        # リアルタイムメトリクスレコードを作成
        item = {
            "sessionId": session_id,
            "createdAt": current_timestamp,  # 各メッセージごとに一意のタイムスタンプ
            "dataType": "realtime-metrics",
            "messageNumber": metrics_data.get("messageCount", 1),
            "angerLevel": metrics_data.get("angerLevel", 0),
            "trustLevel": metrics_data.get("trustLevel", 0),
            "progressLevel": metrics_data.get("progressLevel", 0),
            "analysis": metrics_data.get("analysis", ""),
            "userMessage": metrics_data.get("userMessage", ""),
            "expireAt": ttl
        }
        
        # ゴール情報があれば追加
        if "goalStatuses" in metrics_data:
            item["goalStatuses"] = metrics_data["goalStatuses"]
        if "goalScore" in metrics_data:
            item["goalScore"] = metrics_data["goalScore"]
        
        # コンプライアンス結果があれば追加（float -> Decimal変換を含む）
        if compliance_result and compliance_result.get("violations"):
            # 違反データをDynamoDB用に変換
            violations_for_dynamodb = []
            for violation in compliance_result.get("violations", []):
                violation_copy = violation.copy()
                # confidenceフィールドをDecimalに変換
                if "confidence" in violation_copy and isinstance(violation_copy["confidence"], float):
                    violation_copy["confidence"] = Decimal(str(violation_copy["confidence"]))
                violations_for_dynamodb.append(violation_copy)
            
            item["complianceData"] = {
                "score": Decimal(str(compliance_result.get("complianceScore", 100))),
                "violations": violations_for_dynamodb,
                "analysis": compliance_result.get("analysis", "")
            }
        
        # DynamoDBに保存
        table.put_item(Item=item)
        
        logger.info("リアルタイムメトリクスレコードを保存しました", extra={
            "session_id": session_id,
            "message_number": item["messageNumber"],
            "has_compliance_data": "complianceData" in item,
            "created_at": current_timestamp
        })
        
        return True
        
    except Exception as e:
        logger.error("リアルタイムメトリクスデータの保存に失敗しました", extra={
            "error": str(e),
            "session_id": session_id
        })
        return False

def calculate_goal_score_from_statuses(goal_statuses: List[Dict[str, Any]], scenario_goals: List[Dict[str, Any]]) -> int:
    """
    ゴール達成状況からゴールスコアを計算
    
    Args:
        goal_statuses: ゴール達成状況のリスト
        scenario_goals: シナリオのゴール定義
        
    Returns:
        int: ゴールスコア（0-100）
    """
    if not goal_statuses or not scenario_goals:
        return 0
    
    try:
        total_weight = 0
        achieved_weight = 0
        
        for status in goal_statuses:
            goal_id = status.get('goalId')
            progress = status.get('progress', 0)
            
            # 対応するゴール定義を検索
            goal_def = next((g for g in scenario_goals if g.get('id') == goal_id), None)
            if not goal_def:
                continue
            
            # 重みは優先度を使用（優先度が高いほど重要）
            weight = goal_def.get('priority', 1)
            total_weight += weight
            achieved_weight += (progress / 100.0) * weight
        
        if total_weight == 0:
            return 0
        
        # 0-100の範囲でスコアを計算
        score = int((achieved_weight / total_weight) * 100)
        return max(0, min(100, score))
        
    except Exception as e:
        logger.error("ゴールスコア計算エラー", extra={
            "error": str(e),
            "goal_statuses_count": len(goal_statuses),
            "scenario_goals_count": len(scenario_goals)
        })
        return 0

# APIGatewayRestResolverを使用するためのlambda_handler
@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
