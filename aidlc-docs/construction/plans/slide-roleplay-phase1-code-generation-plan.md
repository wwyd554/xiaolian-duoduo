# Code Generation Plan - 提案資料スライド連動ロールプレイ Phase 1

## 概要
Phase 1: スライド表示 + 手動提示の実装

---

## 実装ステップ

### Step 1: 型定義追加（frontend/src/types/）
- [x] `api.ts`に`SlideImageInfo`、`PresentationFileInfo`型を追加
- [x] `ScenarioInfo`に`presentationFile?: PresentationFileInfo`フィールド追加

### Step 2: バックエンド - スライド画像ストレージ（CDK）
- [x] `cdk/lib/constructs/storage/slide-storage.ts` 新規作成（pdf-storage.tsパターン踏襲）
- [x] スライド画像用S3バケット作成（暗号化、CORS、SSL必須）
- [x] `cdk/lib/infrastructure-stack.ts`にSlideStorageConstruct追加
- [x] `cdk/lib/constructs/api.ts`のBackendApiPropsにslideStorageBucket追加
- [x] `cdk/lib/constructs/api/scenario-lambda.ts`にslideBucket追加

### Step 3: バックエンド - PDF→画像変換Lambda
- [x] `cdk/lambda/slideConvert/index.py` 新規作成
- [x] `cdk/lambda/slideConvert/requirements.txt` 新規作成
- [x] `cdk/lambda/slideConvert/Dockerfile` 新規作成（poppler依存のためコンテナLambda）
- [x] `cdk/lib/constructs/api/slide-convert-lambda.ts` CDKコンストラクト新規作成
- [x] `cdk/lib/constructs/api.ts`にSlideConvertLambda追加

### Step 4: バックエンド - 提案資料アップロードAPI（Scenarios Lambda拡張）
- [x] `cdk/lambda/scenarios/index.py`に提案資料アップロード用署名付きURL取得エンドポイント追加
- [x] 提案資料削除エンドポイント追加
- [x] スライド画像一覧取得エンドポイント追加
- [x] スライド変換トリガーエンドポイント追加
- [x] `cdk/lib/constructs/api/api-gateway.ts`に新エンドポイント追加
- [x] ScenarioLambdaにSLIDE_CONVERT_FUNCTION環境変数・呼び出し権限追加

### Step 5: フロントエンド - APIサービス拡張
- [x] `frontend/src/services/ApiService.ts`に提案資料関連メソッド追加

### Step 6: フロントエンド - シナリオ作成画面に「提案資料」ステップ追加
- [x] `frontend/src/pages/scenarios/creation/PresentationStep.tsx` 新規作成
- [x] `ScenarioCreatePage.tsx`のsteps配列に「提案資料」ステップ追加
- [x] `ScenarioCreatePage.tsx`のformDataに`presentationFile`フィールド追加
- [x] ステップインデックス更新（バリデーション、レンダリング）

### Step 7: フロントエンド - スライドトレイコンポーネント
- [x] `frontend/src/components/conversation/SlideTray.tsx` 新規作成

### Step 8: フロントエンド - スライド拡大モーダル
- [x] `frontend/src/components/conversation/SlideZoomModal.tsx` 新規作成

### Step 9: フロントエンド - ConversationPageにスライドトレイ統合
- [ ] ConversationPage.tsxにスライド関連state・SlideTray・SlideZoomModal統合（Phase 2で実施）

### Step 10: i18n - 日英翻訳キー追加
- [x] `frontend/src/i18n/locales/ja.json`にスライド関連キー追加
- [x] `frontend/src/i18n/locales/en.json`にスライド関連キー追加

### Step 11: リント・型チェック
- [x] getDiagnosticsで全変更ファイルの型エラー確認: エラーなし
