# eslint-plugin-i18n-keys

AIセールスロールプレイ用の翻訳キー検証ESLintプラグイン

## インストール

```bash
npm install --save-dev ./eslint-plugin-i18n-keys
```

## 使用方法

`.eslintrc.js` ファイルに以下の設定を追加します：

```javascript
module.exports = {
  plugins: ["i18n-keys"],
  extends: ["plugin:i18n-keys/recommended"],
};
```

## ルール

このプラグインでは以下のルールが提供されます：

### no-duplicate-keys

翻訳ファイル内の重複キーを検出します。

```javascript
// .eslintrc.js
rules: {
  'i18n-keys/no-duplicate-keys': 'error'
}
```

### ensure-i18n-initialized

i18n初期化チェックのない翻訳使用を検出します。

```javascript
// .eslintrc.js
rules: {
  'i18n-keys/ensure-i18n-initialized': 'warn'
}
```

### no-raw-translation-keys

翻訳キーがそのまま表示されている可能性のあるコードを検出します。

```javascript
// .eslintrc.js
rules: {
  'i18n-keys/no-raw-translation-keys': 'error'
}
```

## 推奨設定

推奨設定は以下のルールを含みます：

```javascript
// .eslintrc.js
extends: [
  'plugin:i18n-keys/recommended'
]
```
