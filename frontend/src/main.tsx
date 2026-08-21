import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// i18nの初期化を明示的にインポート（初期化を確実に行うため）
import i18n from "./i18n/i18n";

// 注: 本地部署版不再初始化 aws-amplify（认证改为邀请码制 JWT，见 services/LocalAuth.ts）

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
