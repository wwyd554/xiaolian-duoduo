// React imports
import { useCallback, useEffect, useState } from "react";
import { BrowserRouter as Router } from "react-router-dom";

import { ThemeProvider } from "@mui/material";
import theme from "./theme/theme";
import CssBaseline from "@mui/material/CssBaseline";

// 组件导入
import AppAccessGate from "./components/AppAccessGate";
import { loadAuth } from "./services/LocalAuth";

// i18n 相关导入
import { useTranslation } from "react-i18next";
import { LanguageService } from "./services/LanguageService";

function App() {
  const { i18n } = useTranslation();
  const languageService = LanguageService.getInstance();
  // 本地邀请码认证状态（登录成功/已有本地凭据时进入主应用）
  const [authed, setAuthed] = useState<boolean>(() => !!loadAuth());
  const handleLoginSuccess = useCallback(() => setAuthed(true), []);

  // 语言设置的初始化
  useEffect(() => {
    // 设置 RTL 语言（阿拉伯语、希伯来语等）的文字方向
    const isRTL = ["ar", "he"].includes(i18n.language);
    document.dir = isRTL ? "rtl" : "ltr";
  }, [i18n.language]);

  useEffect(() => {
    // 从本地存储读取已保存的语言设置
    languageService
      .loadLanguageSettingFromUserProfile()
      .catch((error) => console.error("语言设置加载失败:", error));

    // 开发环境下 i18n 状态的调试日志
    if (process.env.NODE_ENV === "development") {
      console.log(
        "🔤 i18n initialized status:",
        i18n.isInitialized,
        "language:",
        i18n.language,
      );
    }
  }, [languageService, i18n.isInitialized, i18n.language]);

  // 静态示例可预览；真实功能按路径检查登录状态
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppAccessGate authed={authed} onLoginSuccess={handleLoginSuccess} />
      </Router>
    </ThemeProvider>
  );
}

export default App;
