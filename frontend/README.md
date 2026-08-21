# AI営業ロールプレイ - フロントエンド

## 概要

AI営業ロールプレイは、入社3年目までの若手営業担当者を対象に、AIとのインタラクティブなシミュレーションを通じて営業スキルの向上を図るAI駆動型ロールプレイングシステムです。

## 主要機能

- **AIによる動的対話機能**: ユーザーの応答に適応するNPCとの自然な音声対話
- **パフォーマンス評価機能**: 複数パラメータ（怒りメーター、信頼度、進捗度）によるリアルタイムスコアリング
- **シナリオ管理機能**: カスタマイズ可能な様々な営業シーン用テンプレート
- **NPC設定機能**: カスタマイズ可能なキャラクター属性（性格、役職、業種）
- **フィードバック機能**: 改善提案を含む詳細な分析レポート
- **進捗管理機能**: シナリオごとに定義したゴール目標に対する進捗
- **会話ゴール機能**: シナリオごとに設定された具体的なゴールとその達成度評価

## 技術スタック

- **フレームワーク**: React 19
- **言語**: TypeScript
- **UIライブラリ**: Material UI 7
- **ビルドツール**: Vite 6
- **認証**: AWS Amplify v6

## 開発環境のセットアップ

### 前提条件

- Node.js 22.x以上
- npm 9.x以上

### インストール手順

1. リポジトリをクローン

```bash
git clone https://github.com/aws-samples/sample-ai-sales-roleplay.git
cd sample-ai-sales-roleplay/frontend
```

2. 依存関係をインストール

```bash
npm install
```

3. 開発サーバーを起動

```bash
npm run dev
```

4. ブラウザで http://localhost:5173 にアクセス

## 利用可能なスクリプト

- `npm run dev` - 開発サーバーを起動
- `npm run build` - 本番用ビルドを作成
- `npm run lint` - ESLintによるコード検証
- `npm run test` - Jestによるテスト実行

## 環境変数

アプリケーションは以下の環境変数を使用します：

| 変数名                   | 説明                          | デフォルト値              |
| ------------------------ | ----------------------------- | ------------------------- |
| VITE_REGION              | AWSリージョン                 | ap-northeast-1            |
| VITE_USER_POOL_ID        | CognitoユーザープールID       | -                         |
| VITE_USER_POOL_CLIENT_ID | CognitoクライアントID         | -                         |
| VITE_API_ENDPOINT        | バックエンドAPIエンドポイント | http://localhost:3000/api |

| VITE_ENVIRONMENT | 環境名（dev/staging/prod） | dev |


## プロジェクト構造

```
frontend/
├── public/          # 静的ファイル
├── src/             # ソースコード
│   ├── assets/      # 画像、フォントなどのアセット
│   ├── components/  # Reactコンポーネント
│   ├── data/        # 静的データ（シナリオ、NPCなど）
│   ├── pages/       # ページコンポーネント
│   ├── services/    # APIサービス
│   ├── styles/      # グローバルスタイル
│   ├── types/       # TypeScript型定義
│   └── utils/       # ユーティリティ関数
└── docs/            # ドキュメント
```
