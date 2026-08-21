import json
import os
import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, CORSConfig
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.event_handler.exceptions import (
    InternalServerError, NotFoundError
)

# Powertools ロガー設定
logger = Logger(service="guardrails-api")

# CORS設定 - 開発環境では全てのオリジンを許可
cors_config = CORSConfig(
    allow_origin="*",  # 本番環境では特定のドメインに限定
    max_age=300,
    allow_headers=["Content-Type", "Authorization", "X-Api-Key", "X-Amz-Security-Token", "X-Amz-Date"],
    allow_credentials=True  # 認証情報を許可
)

# APIGatewayRestResolverの初期化
app = APIGatewayRestResolver(cors=cors_config)

# BedrockクライアントとDynamoDBクライアントの初期化
bedrock_client = boto3.client('bedrock')
ENVIRONMENT_PREFIX = os.environ.get('ENVIRONMENT_PREFIX', 'dev')

@app.get("/guardrails")
def get_guardrails():
    """
    利用可能なGuardrailsの一覧を取得
    
    Returns:
        dict: Guardrailsリストと説明
    """
    try:
        # Bedrockからガードレール一覧を取得
        response = bedrock_client.list_guardrails()
        guardrails = response.get('guardrails', [])
        
        # 環境に合わせたフィルタリング
        filtered_guardrails = []
        for guardrail in guardrails:
            try:
                # タグに基づいてフィルタリング
                tags_response = bedrock_client.list_tags_for_resource(
                    resourceARN=guardrail['arn']
                )
                tags = tags_response.get('tags', [])
                
                # 環境タグの確認
                is_matching_environment = False
                for tag in tags:
                    if tag.get('key') == 'environment' and tag.get('value') == ENVIRONMENT_PREFIX:
                        is_matching_environment = True
                        break
                
                if is_matching_environment:
                    # list_guardrailsから取得できるバージョン情報を使用
                    guardrail_version = guardrail.get('version', '1')
                    
                    # ガードレールの詳細情報を取得
                    try:
                        guardrail_detail = bedrock_client.get_guardrail(
                            guardrailIdentifier=guardrail['id'],
                            guardrailVersion=guardrail_version
                        )
                    except Exception as detail_error:
                        logger.warning(f"ガードレール詳細取得失敗: {guardrail['id']}", extra={"error": str(detail_error)})
                        # 詳細情報が取得できない場合は基本情報のみを使用
                        guardrail_detail = {'description': ''}
                    
                    # フロントエンドに必要な情報を抽出
                    guardrail_info = {
                        'id': guardrail['id'],
                        'name': guardrail['name'],
                        'description': guardrail_detail.get('description', ''),
                        'version': guardrail_version,
                        'arn': guardrail['arn'],
                        'createdAt': str(guardrail['createdAt']),
                        'updatedAt': str(guardrail['updatedAt'])
                    }
                    
                    filtered_guardrails.append(guardrail_info)
                    
            except Exception as guardrail_error:
                logger.warning(f"ガードレール処理エラー: {guardrail.get('id', 'unknown')}", extra={"error": str(guardrail_error)})
                continue
        
        # 成功レスポンス
        return {
            "guardrails": filtered_guardrails
        }
            
    except Exception as e:
        logger.exception("Guardrails一覧取得エラー", extra={"error": str(e)})
        raise InternalServerError(f"Guardrails一覧の取得中にエラーが発生しました: {str(e)}")

@app.get("/guardrails/{guardrail_id}")
def get_guardrail_detail(guardrail_id: str):
    """
    特定のGuardrailの詳細情報を取得
    
    Args:
        guardrail_id: 取得するGuardrailのID
        
    Returns:
        dict: Guardrailの詳細情報
    """
    try:
        # まず一覧からガードレールを検索してバージョン情報を取得
        response = bedrock_client.list_guardrails()
        guardrails = response.get('guardrails', [])
        
        target_guardrail = None
        for guardrail in guardrails:
            if guardrail['id'] == guardrail_id:
                target_guardrail = guardrail
                break
        
        if not target_guardrail:
            raise NotFoundError(f"指定されたガードレールが見つかりません: {guardrail_id}")
        
        # 環境タグの確認
        tags_response = bedrock_client.list_tags_for_resource(
            resourceARN=target_guardrail['arn']
        )
        tags = tags_response.get('tags', [])
        
        is_matching_environment = False
        for tag in tags:
            if tag.get('key') == 'environment' and tag.get('value') == ENVIRONMENT_PREFIX:
                is_matching_environment = True
                break
        
        if not is_matching_environment:
            raise NotFoundError(f"指定されたガードレールが見つかりません: {guardrail_id}")
        
        # ガードレールの詳細情報を取得
        guardrail_version = target_guardrail.get('version', '1')
        try:
            guardrail_detail = bedrock_client.get_guardrail(
                guardrailId=guardrail_id,
                guardrailVersion=guardrail_version
            )
        except bedrock_client.exceptions.ResourceNotFoundException:
            raise NotFoundError(f"指定されたガードレールが見つかりません: {guardrail_id}")
        
        # フロントエンドに必要な情報を抽出
        result = {
            'id': guardrail_id,
            'name': guardrail_detail.get('name', ''),
            'description': guardrail_detail.get('description', ''),
            'version': guardrail_version,
            'arn': guardrail_detail.get('arn', ''),
            'createdAt': str(guardrail_detail.get('createdAt', '')),
            'updatedAt': str(guardrail_detail.get('updatedAt', ''))
        }
        
        return result
        
    except NotFoundError:
        raise
    except Exception as e:
        logger.exception(f"ガードレール詳細取得エラー: {guardrail_id}", extra={"error": str(e)})
        raise InternalServerError(f"ガードレール詳細の取得中にエラーが発生しました: {str(e)}")

@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_REST)
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """
    Lambda関数のエントリーポイント
    
    APIGatewayRestResolverを使用してイベントを処理します。
    Powertoolsのロガーコンテキストを注入し、相関IDを設定します。
    
    Args:
        event: Lambda関数に渡されるイベントデータ
        context: Lambda関数のランタイムコンテキスト
        
    Returns:
        dict: APIGatewayRestResolverによって生成されたレスポンス
    """
    # リクエスト情報をログに出力
    logger.info(f"Lambda関数が呼び出されました: {event.get('path', 'unknown')}, method={event.get('httpMethod', 'unknown')}")
    
    try:
        return app.resolve(event, context)
    except Exception as e:
        logger.exception(f"予期しないエラーが発生しました: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "内部サーバーエラーが発生しました"})
        }
