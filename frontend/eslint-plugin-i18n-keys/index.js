/**
 * AI 销售陪练用的翻译 key 校验 ESLint 插件
 */

module.exports = {
  rules: {
    // 重复 key 检测规则
    "no-duplicate-keys": {
      meta: {
        type: "problem",
        docs: {
          description: "检测翻译文件中的重复 key",
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
                  message: `key '${keyName}' 重复。`,
                });
              } else {
                keys.add(keyName);
              }
            }
          },
        };
      },
    },

    // 未初始化 i18n 使用检测规则
    "ensure-i18n-initialized": {
      meta: {
        type: "problem",
        docs: {
          description: "检测没有 i18n 初始化检查的翻译使用",
          category: "Possible Errors",
          recommended: true,
        },
        fixable: null,
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            // 查找 t 函数的调用
            if (
              node.callee &&
              node.callee.name === "t" &&
              node.arguments.length > 0 &&
              node.arguments[0].type === "Literal"
            ) {
              // 确认组件内是否检查了 i18n.isInitialized
              const functionScope = context.getScope().upper;
              if (!functionScope) return;

              // 查找 i18n.isInitialized 的使用
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
                  message: `在没有 i18n 初始化检查的情况下使用了 t() 函数。翻译 key "${node.arguments[0].value}" 可能会被原样显示。`,
                });
              }
            }
          },
        };
      },
    },

    // 检测翻译 key 被原样显示的代码
    "no-raw-translation-keys": {
      meta: {
        type: "problem",
        docs: {
          description: "确认翻译 key 没有被原样显示",
          category: "Possible Errors",
          recommended: true,
        },
        fixable: null,
        schema: [],
      },
      create(context) {
        return {
          JSXText(node) {
            // 检测 conversation.audioSettings.title 之类的模式
            const text = node.value.trim();
            if (/^\w+\.\w+\.\w+$/.test(text)) {
              context.report({
                node,
                message: `翻译 key "${text}" 可能被原样显示`,
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
                  message: `翻译 key "${text}" 可能在属性中被原样使用`,
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
