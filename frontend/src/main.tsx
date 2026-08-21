import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { Amplify } from "aws-amplify";
import { amplifyConfig } from "./amplifyconfiguration";

// i18nの初期化を明示的にインポート（初期化を確実に行うため）
import i18n from "./i18n/i18n";

// 統合されたAmplify設定を使用
Amplify.configure(amplifyConfig);

// i18nの初期化が完了していることを確認した上でアプリをレンダリング
const renderApp = () => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

// i18nの初期化を確実に待つ
if (i18n.isInitialized) {
  console.log("🔤 i18n is already initialized, rendering app immediately");
  renderApp();
} else {
  console.log("🔤 waiting for i18n to initialize...");
  i18n.on("initialized", () => {
    console.log("🔤 i18n initialized event triggered, rendering app now");
    renderApp();
  });
}
