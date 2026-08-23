import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// 显式导入 i18n 的初始化（确保初始化被可靠执行）
import i18n from "./i18n/i18n";

// 注: 本地部署版不再初始化 aws-amplify（认证改为邀请码制 JWT，见 services/LocalAuth.ts）

// 确认 i18n 初始化完成后再渲染应用
const renderApp = () => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

// 确保等待 i18n 初始化完成
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
