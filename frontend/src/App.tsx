// React imports
import { useEffect, useState } from "react";
import { BrowserRouter as Router } from "react-router-dom";

import { ThemeProvider, createTheme, responsiveFontSizes } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

// 组件导入
import AppContent from "./components/AppContent";
import InviteLogin from "./components/InviteLogin";
import { DEV_BYPASS_ENABLED, devLogin, loadAuth } from "./services/LocalAuth";

// i18n 相关导入
import { useTranslation } from "react-i18next";
import { LanguageService } from "./services/LanguageService";

// Material UI 主题设置
let theme = createTheme({
  palette: {
    primary: {
      main: "#2b59d1",
      contrastText: "#f6f3f1",
    },
    secondary: {
      main: "#17181a",
    },
    background: {
      default: "#f7f7f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#17181a",
      secondary: "rgba(23, 24, 26, 0.62)",
    },
    divider: "rgba(23, 24, 26, 0.1)",
    action: {
      hover: "rgba(36, 36, 36, 0.05)",
    },
  },
  typography: {
    fontFamily:
      'Roboto, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif',
    h1: {
      fontWeight: 750,
      letterSpacing: "-0.035em",
    },
    h2: {
      fontWeight: 750,
      letterSpacing: "-0.03em",
    },
    h3: {
      fontWeight: 750,
      letterSpacing: "-0.025em",
    },
    h4: {
      fontWeight: 750,
      letterSpacing: "-0.02em",
    },
    h5: {
      fontWeight: 700,
      letterSpacing: "-0.015em",
    },
    h6: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    button: {
      fontWeight: 500,
      letterSpacing: "0.02em",
    },
    // 统一语言切换组件等处的字体
    allVariants: {
      fontFamily: "inherit",
    },
  },
  components: {
    // 通过全局样式修复布局问题
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          width: "100%",
          minHeight: "100vh",
          overflow: "auto",
          backgroundColor: "#f7f7f8",
        },
        "#root": {
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        },
      },
    },
    // 统一语言切换组件的字体
    MuiSelect: {
      styleOverrides: {
        select: {
          fontFamily: "inherit",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid #e1e5ed",
          borderRadius: 24,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 14,
          padding: "12px 24px",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
        outlined: {
          borderColor: "#242424",
          color: "#242424",
          "&:hover": {
            borderColor: "#242424",
            backgroundColor: "rgba(36,36,36,.05)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: "#ffffff",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#dfe3eb",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#b8c0cf",
          },
        },
      },
    },
    // 响应式设计对应的补充样式
    MuiContainer: {
      styleOverrides: {
        root: {
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto",
          [createTheme().breakpoints.down("sm")]: {
            padding: "0 16px",
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          [createTheme().breakpoints.down("sm")]: {
            padding: "16px",
          },
        },
      },
    },
  },
});

// 转换为响应式字体大小
theme = responsiveFontSizes(theme);

function App() {
  const { i18n } = useTranslation();
  const languageService = LanguageService.getInstance();
  // 本地邀请码认证状态（登录成功/已有本地凭据时进入主应用）
  const [authed, setAuthed] = useState<boolean>(() => !!loadAuth());
  // 开发期直登：DEV_BYPASS=1 时自动免邀请码进入（失败则回退到邀请码表单）
  const [devLoginFailed, setDevLoginFailed] = useState<boolean>(false);

  useEffect(() => {
    if (!authed && DEV_BYPASS_ENABLED && !devLoginFailed) {
      devLogin()
        .then(() => setAuthed(true))
        .catch((error) => {
          console.warn("开发直登失败，回退到邀请码登录:", error);
          setDevLoginFailed(true);
        });
    }
  }, [authed, devLoginFailed]);

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

  // 未登录：展示邀请码登录表单
  if (!authed) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <InviteLogin onSuccess={() => setAuthed(true)} />
      </ThemeProvider>
    );
  }

  // 已登录：主应用
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
