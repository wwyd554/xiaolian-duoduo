# 実行計画書 - 提案資料スライド連動ロールプレイ機能

## 詳細分析サマリー

### 変更影響評価
- **ユーザー向け変更**: あり（会話画面にスライドトレイ追加、シナリオ作成画面に新ステップ追加）
- **構造変更**: あり（新コンポーネント追加、NPC会話エージェントのプロンプト拡張）
- **データモデル変更**: あり（シナリオにスライド情報追加、メッセージにスライド紐付け追加）
- **API変更**: あり（スライド画像取得API、PDF変換API追加）
- **NFR影響**: あり（Bedrock Vision連携によるレイテンシー、S3ストレージ追加）

### コンポーネント関係
- **フロントエンド**: ConversationPage（スライドトレイ追加）、ScenarioCreatePage（新ステップ追加）
- **バックエンド**: NPC会話エージェント（プロンプト拡張）、新Lambda（PDF変換）、Scenarios Lambda（提案資料管理）
- **インフラ**: S3（スライド画像保存）、CDK（新Lambda、API Gateway追加）
- **データ**: DynamoDB（シナリオテーブルにスライド情報追加）

### リスク評価
- **リスクレベル**: Medium
- **理由**: 複数コンポーネントにまたがる変更、Bedrock Vision連携の新規導入、PDF→画像変換パイプライン
- **ロールバック複雑度**: Moderate（段階的実装により軽減）

---

## ワークフロー可視化

```
Phase: INCEPTION
  [x] Workspace Detection .............. COMPLETED
  [x] Reverse Engineering .............. SKIPPED (既存成果物あり)
  [x] Requirements Analysis ............ COMPLETED
  [x] User Stories ..................... SKIPPED (既存ユーザータイプ、要件明確)
  [x] Workflow Planning ................ COMPLETED (本ドキュメント)
  [ ] Application Design ............... SKIP
  [ ] Units Generation ................. SKIP

Phase: CONSTRUCTION
  [ ] Functional Design ................ SKIP
  [ ] NFR Requirements ................. SKIP
  [ ] NFR Design ....................... SKIP
  [ ] Infrastructure Design ............ SKIP
  [ ] Code Generation (Phase 1) ........ EXECUTE
  [ ] Code Generation (Phase 2) ........ EXECUTE
  [ ] Build and Test ................... EXECUTE

Phase: OPERATIONS
  [ ] Operations ....................... PLACEHOLDER
```

---

## 実行ステージ詳細

### 🔵 INCEPTION PHASE
- [x] Workspace Detection (COMPLETED)
- [x] Reverse Engineering (SKIPPED - 既存成果物あり)
- [x] Requirements Analysis (COMPLETED)
- [x] User Stories (SKIPPED - 既存ユーザータイプ、要件が十分明確)
- [x] Workflow Planning (COMPLETED - 本ドキュメント)
- [ ] Application Design - SKIP
  - **理由**: 既存コンポーネント（ConversationPage、ScenarioCreatePage）への追加が主。新規コンポーネントはスライドトレイ・拡大モーダル程度で、モックで設計済み
- [ ] Units Generation - SKIP
  - **理由**: Phase 1/Phase 2の分割は要件定義書で明確。ユニット分割の追加設計は不要

### 🟢 CONSTRUCTION PHASE
- [ ] Functional Design - SKIP
  - **理由**: ビジネスロジックはシンプル（PDF→画像変換、スライド提示記録）。要件定義書で十分
- [ ] NFR Requirements - SKIP
  - **理由**: 要件定義書のNFRセクションで十分。既存NFR設定（認証、暗号化等）を踏襲
- [ ] NFR Design - SKIP
  - **理由**: NFR Requirementsをスキップするため
- [ ] Infrastructure Design - SKIP
  - **理由**: 既存CDKパターン（S3、Lambda、API Gateway）を踏襲。新規インフラパターンなし
- [ ] Code Generation (Phase 1) - EXECUTE
  - **内容**: 提案資料アップロード、PDF→画像変換、スライドトレイUI、拡大モーダル、手動提示
- [ ] Code Generation (Phase 2) - EXECUTE
  - **内容**: Bedrock Vision連携、プロンプト拡張、スライド提示履歴記録、フィードバック統合
- [ ] Build and Test - EXECUTE
  - **内容**: リント、型チェック、ビルド手順書、テスト手順書

---

## パッケージ変更シーケンス

### Phase 1: スライド表示 + 手動提示
1. **cdk/lambda/scenarios/** - 提案資料アップロードAPI追加（署名付きURL）
2. **cdk/lambda/slideConvert/** - 新規Lambda: PDF→画像変換（pdf2image + poppler）
3. **cdk/lib/constructs/storage/** - スライド画像用S3設定
4. **cdk/lib/constructs/api/** - スライド変換Lambda CDKコンストラクト
5. **frontend/src/types/** - スライド関連型定義
6. **frontend/src/services/** - スライドAPI呼び出し
7. **frontend/src/pages/scenarios/creation/** - 提案資料アップロードステップ
8. **frontend/src/components/conversation/** - スライドトレイ、拡大モーダル
9. **frontend/src/pages/ConversationPage.tsx** - スライドトレイ統合
10. **frontend/src/i18n/** - 日英翻訳キー追加

### Phase 2: AI連携 + フィードバック統合
1. **cdk/agents/npc-conversation/** - プロンプトにスライドコンテキスト追加、Bedrock Vision対応
2. **frontend/src/services/AgentCoreService.ts** - スライド画像送信対応
3. **cdk/lambda/sessions/** - メッセージ×スライド紐付けデータ保存
4. **cdk/lambda/sessionAnalysis/** - スライド提示評価プロンプト追加
5. **frontend/src/pages/ResultPage.tsx** - スライド活用評価セクション追加

---

## 推定タイムライン
- **Phase 1 Code Generation**: 2-3時間
- **Phase 2 Code Generation**: 2-3時間
- **Build and Test**: 1時間
- **合計**: 5-7時間

## 成功基準
- PDF提案資料のアップロード・スライド画像変換が正常動作
- 会話画面でスライドトレイが表示され、拡大モーダルが動作
- 手動提示ボタンでスライドがAIに送信される
- NPCがスライド内容を踏まえた応答を生成する
- スライド提示履歴がフィードバックに反映される
- 提案資料なしのシナリオが従来通り動作する
