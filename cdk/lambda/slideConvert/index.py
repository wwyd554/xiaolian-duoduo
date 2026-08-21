"""
PDF→スライド画像変換Lambda

S3イベントトリガーまたはAPI呼び出しで起動し、
PDFの各ページをPNG画像に変換してS3に保存する。
変換完了後、DynamoDBのシナリオテーブルにスライド情報を更新する。
"""

import json
import os
import logging
import tempfile
import boto3
from pdf2image import convert_from_path, pdfinfo_from_path

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

SLIDE_BUCKET = os.environ.get('SLIDE_BUCKET', '')
SCENARIOS_TABLE = os.environ.get('SCENARIOS_TABLE', '')
# 変換画像の解像度（DPI）
CONVERT_DPI = 150
# サムネイルサイズ（幅, 高さ）
THUMBNAIL_SIZE = (320, 240)
# PDFマジックバイト
PDF_MAGIC_BYTES = b'%PDF'
# ページ数上限
MAX_PAGES = 100
# ファイルサイズ上限（100MB）
MAX_PDF_SIZE = 100 * 1024 * 1024

# WR-012: モジュールレベルでDynamoDB Tableリソースを初期化し再利用
scenarios_table = dynamodb.Table(SCENARIOS_TABLE) if SCENARIOS_TABLE else None


def lambda_handler(event, context):
    """Lambda エントリーポイント"""
    logger.info(f"Event: {json.dumps(event, default=str)}")

    # CR-004: scenario_id 未定義エラー防止
    scenario_id = ''

    try:
        # API Gateway経由の呼び出し
        if 'body' in event:
            body = json.loads(event.get('body', '{}'))
            scenario_id = body.get('scenarioId', '')
            pdf_key = body.get('pdfKey', '')
            source_bucket = body.get('sourceBucket', SLIDE_BUCKET)
        # S3イベントトリガー
        elif 'Records' in event:
            record = event['Records'][0]
            source_bucket = record['s3']['bucket']['name']
            pdf_key = record['s3']['object']['key']
            # キーからシナリオIDを抽出: presentations/{scenarioId}/original.pdf
            parts = pdf_key.split('/')
            scenario_id = parts[1] if len(parts) >= 2 else ''
        else:
            return _error_response(400, 'リクエスト形式が不正です')

        if not scenario_id or not pdf_key:
            return _error_response(400, 'scenarioId and pdfKey are required')

        logger.info(f"Converting PDF: bucket={source_bucket}, key={pdf_key}, scenario={scenario_id}")

        # DynamoDBのステータスを「converting」に更新
        _update_scenario_presentation_status(scenario_id, 'converting')

        # PDFをS3からダウンロード・検証・変換
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = os.path.join(tmp_dir, 'input.pdf')
            s3_client.download_file(source_bucket, pdf_key, pdf_path)
            logger.info(f"Downloaded PDF to {pdf_path}")

            # CR-002: ファイルサイズ上限チェック
            file_size = os.path.getsize(pdf_path)
            if file_size > MAX_PDF_SIZE:
                logger.warning(f"PDFファイルサイズ超過: {file_size} bytes")
                return _error_response(400, 'PDFファイルサイズが上限を超えています')

            # CR-002: PDFマジックバイト検証
            with open(pdf_path, 'rb') as f:
                header = f.read(4)
            if header != PDF_MAGIC_BYTES:
                logger.warning(f"不正なファイル形式: マジックバイト={header!r}")
                return _error_response(400, 'アップロードされたファイルはPDF形式ではありません')

            # CR-003: pdfinfo_from_pathでページ数を事前取得
            pdf_info = pdfinfo_from_path(pdf_path)
            total_pages = pdf_info.get('Pages', 0)
            logger.info(f"PDF pages: {total_pages}")

            # CR-002: ページ数上限チェック
            if total_pages > MAX_PAGES:
                logger.warning(f"ページ数超過: {total_pages} pages")
                return _error_response(400, f'ページ数が上限({MAX_PAGES}ページ)を超えています')

            if total_pages == 0:
                return _error_response(400, 'PDFにページが含まれていません')

            # CR-003: ページ単位ストリーミング処理
            slides = []
            for page_num in range(1, total_pages + 1):
                # 1ページずつ変換（メモリ効率化）
                images = convert_from_path(
                    pdf_path, dpi=CONVERT_DPI, fmt='png',
                    first_page=page_num, last_page=page_num,
                )
                img = images[0]

                # フルサイズ画像をS3にアップロード
                img_key = f"presentations/{scenario_id}/slides/page_{page_num:03d}.png"
                img_path = os.path.join(tmp_dir, f"page_{page_num}.png")
                img.save(img_path, 'PNG')
                s3_client.upload_file(
                    img_path, SLIDE_BUCKET, img_key,
                    ExtraArgs={'ContentType': 'image/png'},
                )

                # CR-003: サムネイルはcopy+thumbnailで生成（2回目の変換を廃止）
                thumb = img.copy()
                thumb.thumbnail(THUMBNAIL_SIZE)
                thumb_key = f"presentations/{scenario_id}/thumbnails/page_{page_num:03d}.png"
                thumb_path = os.path.join(tmp_dir, f"thumb_{page_num}.png")
                thumb.save(thumb_path, 'PNG')
                s3_client.upload_file(
                    thumb_path, SLIDE_BUCKET, thumb_key,
                    ExtraArgs={'ContentType': 'image/png'},
                )

                slides.append({
                    'pageNumber': page_num,
                    'imageKey': img_key,
                    'thumbnailKey': thumb_key,
                })

                logger.info(f"Uploaded page {page_num}/{total_pages}")

                # CR-003: 明示的にメモリ解放
                del thumb, img, images

        # DynamoDBにスライド情報を更新
        _update_scenario_slides(scenario_id, total_pages, slides)

        # WR-002: 成功レスポンスに message と data プロパティを追加
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'message': 'PDF変換が完了しました',
                'data': {
                    'scenarioId': scenario_id,
                    'totalPages': total_pages,
                    'slides': slides,
                },
            }),
        }

    except Exception as e:
        logger.error(f"PDF変換エラー: {e}", exc_info=True)
        if scenario_id:
            _update_scenario_presentation_status(scenario_id, 'error')
        # WR-013: エラーメッセージから内部情報を除去
        return _error_response(500, 'PDF変換処理中にエラーが発生しました')


def _get_table():
    """DynamoDB Tableリソースを取得（遅延初期化対応）"""
    global scenarios_table
    if scenarios_table is None:
        scenarios_table = dynamodb.Table(SCENARIOS_TABLE)
    return scenarios_table


def _update_scenario_presentation_status(scenario_id: str, status: str):
    """シナリオの提案資料ステータスを更新（既存アイテムのみ）"""
    try:
        table = _get_table()
        table.update_item(
            Key={'scenarioId': scenario_id},
            UpdateExpression='SET presentationFile.#s = :status',
            ConditionExpression='attribute_exists(scenarioId) AND attribute_exists(title)',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':status': status},
        )
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        logger.info(f"シナリオ {scenario_id} はまだ作成されていないため、ステータス更新をスキップ")
    except Exception as e:
        logger.warning(f"ステータス更新失敗: {e}")


def _update_scenario_slides(scenario_id: str, total_pages: int, slides: list):
    """シナリオにスライド情報を保存（既存アイテムのみ）"""
    table = _get_table()
    try:
        table.update_item(
            Key={'scenarioId': scenario_id},
            UpdateExpression='SET presentationFile.totalPages = :tp, presentationFile.slides = :sl, presentationFile.#s = :status',
            ConditionExpression='attribute_exists(scenarioId) AND attribute_exists(title)',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':tp': total_pages,
                ':sl': slides,
                ':status': 'ready',
            },
        )
        logger.info(f"Updated scenario {scenario_id} with {total_pages} slides")
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        logger.warning(f"シナリオ {scenario_id} はまだ作成されていないため、スライド情報の保存をスキップ。スライド画像はS3に保存済み。")
        # スライド画像はS3に保存済みなので、シナリオ作成後に再変換すれば復旧可能


def _error_response(status_code: int, message: str):
    """エラーレスポンスを生成"""
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'success': False, 'message': message}),
    }
