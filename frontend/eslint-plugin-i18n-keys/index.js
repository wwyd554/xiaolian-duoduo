/**
 * AIセールスロールプレイ用の翻訳キー検証ESLintプラグイン
 */

module.exports = {
  rules: {
    // 重複キー検出ルール
    "no-duplicate-keys": {
      meta: {
        type: "problem",
        docs: {
          description: "翻訳ファイル内の重複キーを検出",
          category: "Possible Errors",
          recommended: true,
        },
        fixable: null,
        schema: [],
      },
      create(context) {
        const keys = new Set();

        return {
          Property(node) {
            if (node.key.type === "Literal" || node.key.type === "Identifier") {
              const keyName =
                node.key.type === "Literal" ? node.key.value : node.key.name;
              if (keys.has(keyName)) {
                context.report({
                  node,
                  message: `キー '${keyName}' が重複しています。`,
                });
              } else {
                keys.add(keyName);
              }
            }
          },
        };
      },
    },

    // 未初期化i18n使用検出ルール
    "ensure-i18n-initialized": {
      meta: {
        type: "problem",
        docs: {
          description: "i18n初期化チェックのない翻訳使用を検出",
          category: "Possible Errors",
          recommended: true,
        },
        fixable: null,
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            // t関数の呼び出しを探す
            if (
              node.callee &&
              node.callee.name === "t" &&
              node.arguments.length > 0 &&
              node.arguments[0].type === "Literal"
            ) {
              // コンポーネント内でi18n.isInitializedをチェックしているか確認
              const functionScope = context.getScope().upper;
              if (!functionScope) return;

              // i18n.isInitializedの使用を探す
              let hasInitCheck = false;
              const variables = functionScope.variables || [];

              for (const variable of variables) {
                if (variable.name === "i18n" || variable.name === "ready") {
                  hasInitCheck = true;
                  break;
                }
              }

              if (!hasInitCheck) {
                context.report({
                  node,
                  message: `i18n初期化チェックなしでt()関数を使用しています。翻訳キー "${node.arguments[0].value}" が表示される可能性があります。`,
                });
              }
            }
          },
        };
      },
    },

    // 翻訳キーがそのまま表示されているコードを検出
    "no-raw-translation-keys": {
      meta: {
        type: "problem",
        docs: {
          description: "翻訳キーがそのまま表示されていないことを確認",
          category: "Possible Errors",
          recommended: true,
        },
        fixable: null,
        schema: [],
      },
      create(context) {
        return {
          JSXText(node) {
            // conversation.audioSettings.title のようなパターンを検出
            const text = node.value.trim();
            if (/^\w+\.\w+\.\w+$/.test(text)) {
              context.report({
                node,
                message: `翻訳キー "${text}" がそのまま表示されている可能性があります`,
              });
            }
          },
          Literal(node) {
            if (
              node.parent.type === "JSXAttribute" &&
              typeof node.value === "string"
            ) {
              const text = node.value.trim();
              if (/^\w+\.\w+\.\w+$/.test(text)) {
                context.report({
                  node,
                  message: `属性内で翻訳キー "${text}" がそのまま使用されている可能性があります`,
                });
              }
            }
          },
        };
      },
    },
  },

  configs: {
    recommended: {
      plugins: ["i18n-keys"],
      rules: {
        "i18n-keys/no-duplicate-keys": "error",
        "i18n-keys/ensure-i18n-initialized": "warn",
        "i18n-keys/no-raw-translation-keys": "error",
      },
    },
  },
};
