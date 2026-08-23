import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// 语言资源文件导入
import jaTranslation from "./locales/ja.json";
import enTranslation from "./locales/en.json";
import zhTranslation from "./locales/zh.json";

const resources = {
  zh: {
    translation: zhTranslation,
  },
  en: {
    translation: enTranslation,
  },
  ja: {
    translation: jaTranslation,
  },
};

i18n
  // 使用语言检测功能
  .use(LanguageDetector)
  // 使用 react-i18next 插件
  .use(initReactI18next)
  .init({
    resources,
    // 默认语言
    fallbackLng: "zh",
    lng: "zh",
    // 调试选项（仅开发模式开启）
    debug: process.env.NODE_ENV === "development",

    interpolation: {
      // 使用 React 渲染，无需担心 XSS 注入
      escapeValue: false,
    },

    // 语言检测选项
    detection: {
      // 语言检测顺序
      order: ["localStorage", "navigator"],
      // localStorage 中的键名
      lookupLocalStorage: "i18nextLng",
      // 保存用户的语言设置
      caches: ["localStorage"],
    },

    // 初始化时等待翻译加载完成
    initImmediate: false,
  });

export default i18n;
