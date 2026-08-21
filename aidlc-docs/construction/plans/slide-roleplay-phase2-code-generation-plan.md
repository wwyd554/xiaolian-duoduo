# Code Generation Plan - 提案資料スライド連動ロールプレイ Phase 2

## 概要
Phase 2: AI連携 + フィードバック統合

---

## 実装ステップ

### Step 1: NPC会話エージェント - プロンプトにスライドコンテキスト追加
- [x] `cdk/agents/npc-conversation/prompts.py`にスライドコンテキストセクション追加 + `_build_slide_context`関数
- [x] `cdk/agents/npc-conversation/agent.py`にpresentedSlides受け取り + `_build_multimodal_message`関数

### Step 2: フロントエンド - AgentCoreService拡張（スライド画像送信対応）
- [x] `AgentCoreService.ts`の`chatWithNPC`にpresentedSlides引数追加
- [x] `ApiService.ts`の`chatWithNPC`にpresentedSlides引数追加

### Step 3: ConversationPage - スライドトレイ統合 + メッセージ×スライド紐付け
- [x] ConversationPage.tsxにスライド関連state追加（slideImages, currentSlideIndex, presentedSlidePages, isSlideZoomOpen）
- [x] シナリオ読み込み時にスライド画像一覧を取得（getSlideImages API呼び出し）
- [x] SlideTray + SlideZoomModalをレイアウトに統合（アバターステージとチャットログの間）
- [x] handleSlidePresent: 提示ボタン押下時にpresentedSlidePagesを更新
- [x] chatWithNPC呼び出し時にpresentedSlides（画像URL付き）を渡す
- [x] presentedSlidePagesRefで最新の提示済みスライドを参照

### Step 4: セッション分析 - スライド提示評価プロンプト追加
- [x] `cdk/lambda/sessionAnalysis/prompts.py`にslide_historyパラメータ + スライド提示評価セクション追加

### Step 5: 結果画面 - スライド活用評価セクション追加
- [ ] ResultPage.tsxへの追加（フィードバックデータにスライド評価が含まれるため、既存UIで表示可能。専用セクションは将来追加）

### Step 6: リント・型チェック
- [x] getDiagnosticsで全変更ファイルの型エラー確認: エラーなし
