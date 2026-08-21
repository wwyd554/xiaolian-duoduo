# Amazon Polly Lexicon の概要と使い方

## 概要

Amazon Polly Lexicon（発音辞書）は、特定の単語やフレーズの発音をカスタマイズするための機能です。AI営業ロールプレイシステムでは、以下の目的で使用されています：

- 専門用語の正確な発音制御
- 固有名詞の発音カスタマイズ
- 略語・頭字語の自然な発音
- 多言語環境での一貫した発音

## 技術概要

### 構成要素

1. **Lexiconファイル**
   - XML形式で記述されたPLS (Pronunciation Lexicon Specification)形式
   - 各言語ごとに個別のファイルで管理（`ja-JP.xml`, `en-US.xml` など）

2. **CDKカスタムリソース**
   - `PollyLexiconCustomResource`: AwsCustomResourceを使用してLexiconのライフサイクルを管理
   - 作成/更新/削除操作をサポート

3. **テキスト音声合成との統合**
   - TextToSpeech Lambda関数でLexiconを指定
   - 言語コードに基づいて適切なLexiconを選択

### ファイル構造

```
cdk/
  ├── lib/
  │   └── custom-resources/
  │       └── polly-lexicon/
  │           ├── index.ts                    # エクスポートファイル
  │           ├── polly-lexicon-custom-resource.ts  # メインのリソース実装
  │           ├── sample-lexicon.ts           # レキシコン読み込み機能
  │           └── lexicons/                   # レキシコンXMLファイル
  │               ├── ja-JP.xml               # 日本語レキシコン
  │               └── en-US.xml               # 英語レキシコン
```

## レキシコンの編集方法

### レキシコンの基本構造

レキシコンはXMLファイルで、以下の形式で記述します：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<lexicon version="1.0" 
      xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
      xsi:schemaLocation="http://www.w3.org/2005/01/pronunciation-lexicon 
        http://www.w3.org/TR/2007/CR-pronunciation-lexicon-20071212/pls.xsd"
      alphabet="ipa" 
      xml:lang="ja-JP">
  <lexeme>
    <grapheme>単語</grapheme>
    <alias>発音</alias>
  </lexeme>
  <!-- 他の単語エントリを追加 -->
</lexicon>
```

### 発音エントリの追加方法

1. 該当言語のXMLファイル（`lexicons/ja-JP.xml`など）を開きます
2. `<lexeme>...</lexeme>`ブロック内に新しいエントリを追加します

例）日本語の場合：
```xml
<lexeme>
  <grapheme>AWS</grapheme>
  <alias>エーダブリューエス</alias>
</lexeme>
```

例）英語の場合：
```xml
<lexeme>
  <grapheme>AWS</grapheme>
  <alias>A.W.S.</alias>
</lexeme>
```

### 発音方法のタイプ

Lexiconでは以下の方法で発音をカスタマイズできます：

1. **`<alias>`タグ** - 代替テキスト指定（最も簡単）
   ```xml
   <lexeme>
     <grapheme>AI</grapheme>
     <alias>エーアイ</alias>
   </lexeme>
   ```

2. **`<phoneme>`タグ** - IPA（国際音声記号）による詳細な発音指定
   ```xml
   <lexeme>
     <grapheme>tomato</grapheme>
     <phoneme alphabet="ipa">təˈmeɪtoʊ</phoneme>
   </lexeme>
   ```

## デプロイと使用方法

### デプロイ方法

レキシコンはインフラストラクチャスタックのデプロイ時に自動的に作成されます：

```bash
# CDKデプロイコマンド
cd cdk
npm run build
npx cdk deploy AISalesRoleplay-dev-InfrastructureStack
```

### 更新方法

レキシコンの内容を更新する場合は：

1. 該当するXMLファイルを編集
2. CDKスタックを再デプロイ

### テキスト音声合成での使用

音声合成時に自動的に適用されます。TextToSpeech Lambda関数では以下のように使用されています：

```typescript
// PollyパラメータにLexiconを設定
const pollyParams = {
  // ...その他のパラメータ
  LexiconNames: languageCode.startsWith('ja') 
    ? [process.env.JAPANESE_LEXICON_NAME || ''] 
    : languageCode.startsWith('en')
      ? [process.env.ENGLISH_LEXICON_NAME || '']
      : [],
};
```

## ベストプラクティス

1. **サイズ制限を考慮** - 各Lexiconファイルは100KB以下に抑える
2. **一般的な単語より特殊な単語に焦点** - 一般単語は既に最適化されている
3. **音声合成エンジンとの相性確認** - 標準・ニューラルエンジンで効果が異なる場合がある
4. **テキストタイプの考慮** - SSMLとプレーンテキストでの挙動の違いを理解する
5. **フォールバックを用意** - 特定のレキシコンが適用できない場合のフォールバック対応

## トラブルシューティング

1. **発音が変わらない場合**
   - レキシコン名が正しく設定されているか確認
   - 言語コードとレキシコンの`xml:lang`属性が一致しているか確認

2. **デプロイエラー**
   - XMLの構文エラーがないか確認
   - レキシコンサイズが制限内か確認

3. **特定の単語が期待通りに発音されない**
   - 音声合成ログを確認（CloudWatch Logs）
   - SSMLタグとの競合がないか確認

## 参考リンク

- [Amazon Polly Lexicon 公式ドキュメント](https://docs.aws.amazon.com/polly/latest/dg/managing-lexicons.html)
- [PLS (Pronunciation Lexicon Specification) W3C規格](https://www.w3.org/TR/pronunciation-lexicon/)
- [IPA (国際音声記号) リファレンス](https://en.wikipedia.org/wiki/International_Phonetic_Alphabet)