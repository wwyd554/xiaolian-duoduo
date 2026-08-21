# Amazon Polly Lexicon カスタムリソース

## 概要

このカスタムリソースは、AWS CDKを使用してAmazon Polly用のLexicon（発音辞書）を管理します。
Lexiconを使用することで、AI営業ロールプレイシステムにおける特殊な単語や専門用語の発音を
カスタマイズし、より自然な音声合成を実現します。

## 機能

- **Lexicon作成**: 新規のLexiconをAmazon Pollyに登録
- **Lexicon更新**: 既存のLexiconを削除して新規のものに置き換え
- **Lexicon削除**: スタック削除時にLexiconも自動的に削除

## 使用方法

### インフラストラクチャスタックでの使用例

```typescript
import { PollyLexiconCustomResource } from './custom-resources/polly-lexicon';
import { loadLexicon } from './custom-resources/polly-lexicon/sample-lexicon';

// Polly Lexiconカスタムリソースの作成
const jaLexicon = new PollyLexiconCustomResource(this, 'JapaneseLexicon', {
  lexiconName: `${resourcePrefix}JapaneseLexicon`,
  lexiconContent: loadLexicon('ja-JP.xml'),
  resourceId: 'PollyJapaneseLexiconResource'
});

// TextToSpeech Lambda関数に環境変数として設定
textToSpeechFunction.addEnvironment('JAPANESE_LEXICON_NAME', `${resourcePrefix}JapaneseLexicon`);
```

### 必要なIAM権限

このカスタムリソースは以下のIAM権限を使用します：

```typescript
new iam.PolicyStatement({
  actions: [
    'polly:PutLexicon',
    'polly:GetLexicon', 
    'polly:DeleteLexicon',
    'polly:ListLexicons'
  ],
  resources: ['*']
})
```

## レキシコンファイルの編集

レキシコンは `lexicons/` ディレクトリ内のXMLファイルとして管理されています：

- `ja-JP.xml`: 日本語レキシコン
- `en-US.xml`: 英語レキシコン

詳しい編集方法は [発音辞書のドキュメント](/docs/custom-resources/polly-lexicon-guide.md) を参照してください。

## 関連リソース

- [Amazon Polly Lexiconドキュメント](https://docs.aws.amazon.com/polly/latest/dg/managing-lexicons.html)
- [発音レキシコン仕様 (PLS)](https://www.w3.org/TR/pronunciation-lexicon/)