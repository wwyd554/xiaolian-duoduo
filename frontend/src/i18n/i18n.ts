import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// 言語リソースファイルのインポート
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
  // 言語検出機能を使用
  .use(LanguageDetector)
  // react-i18nextのプラグインを使用
  .use(initReactI18next)
  .init({
    resources,
    // デフォルト言語
    fallbackLng: "zh",
    lng: "zh",
    // デバッグオプション（開発時のみtrueにする）
    debug: process.env.NODE_ENV === "development",

    interpolation: {
      // Reactを使用しているため、XSSインジェクションを心配する必要はない
      escapeValue: false,
    },

    // 言語検出のオプション
    detection: {
      // 言語検出の順序
      order: ["localStorage", "navigator"],
      // localStorage内のキー名
      lookupLocalStorage: "i18nextLng",
      // ユーザーの言語設定を保存
      caches: ["localStorage"],
    },

    // 初期化時に翻訳がロードされるまで待機
    initImmediate: false,
  });

export default i18n;
