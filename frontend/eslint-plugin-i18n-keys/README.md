# eslint-plugin-i18n-keys

AI 销售陪练用的翻译 key 校验 ESLint 插件

## 安装

```bash
npm install --save-dev ./eslint-plugin-i18n-keys
```

## 使用方法

在 `.eslintrc.js` 文件中添加以下配置：

```javascript
module.exports = {
  plugins: ["i18n-keys"],
  extends: ["plugin:i18n-keys/recommended"],
};
```

## 规则

本插件提供以下规则：

### no-duplicate-keys

检测翻译文件中的重复 key。

```javascript
// .eslintrc.js
rules: {
  'i18n-keys/no-duplicate-keys': 'error'
}
```

### ensure-i18n-initialized

检测没有 i18n 初始化检查的翻译使用。

```javascript
// .eslintrc.js
rules: {
  'i18n-keys/ensure-i18n-initialized': 'warn'
}
```

### no-raw-translation-keys

检测翻译 key 可能被原样显示的代码。

```javascript
// .eslintrc.js
rules: {
  'i18n-keys/no-raw-translation-keys': 'error'
}
```

## 推荐配置

推荐配置包含以下规则：

```javascript
// .eslintrc.js
extends: [
  'plugin:i18n-keys/recommended'
]
```
