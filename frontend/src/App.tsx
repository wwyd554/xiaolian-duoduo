// React imports
import { useEffect, useState } from "react";
import { BrowserRouter as Router } from "react-router-dom";

import { ThemeProvider, createTheme, responsiveFontSizes } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

// コンポーネントのインポート
import AppContent from "./components/AppContent";
import InviteLogin from "./components/InviteLogin";
import { DEV_BYPASS_ENABLED, devLogin, loadAuth } from "./services/LocalAuth";

// i18n関連のインポート
import { useTranslation } from "react-i18next";
import { LanguageService } from "./services/LanguageService";

// Material UI テーマ設定
let theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
    background: {
      default: "#f5f5f5",
    },
  },
  typography: {
    fontFamily: "Roboto, Arial, sans-serif",
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    // 言語切り替えコンポーネントなどのフォントを統一
    allVariants: {
      fontFamily: "Roboto, Arial, sans-serif",
    },
  },
  components: {
    // グローバルスタイルでレイアウト問題を修正
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          width: "100%",
          minHeight: "100vh",
          overflow: "auto",
        },
        "#root": {
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        },
      },
    },
    // 言語切り替えコンポーネントのフォント統一
    MuiSelect: {
      styleOverrides: {
        select: {
          fontFamily: "Roboto, Arial, sans-serif",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: "Roboto, Arial, sans-serif",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          borderRadius: 12,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
        },
      },
    },
    // レスポンシブデザイン対応の追加スタイル
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

// レスポンシブなフォントサイズに変換
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

  // 言語設定の初期化
  useEffect(() => {
    // RTL言語（アラビア語、ヘブライ語等）の文字方向を設定
    const isRTL = ["ar", "he"].includes(i18n.language);
    document.dir = isRTL ? "rtl" : "ltr";
  }, [i18n.language]);

  useEffect(() => {
    // ローカルストレージから保存済み言語設定を読み込み
    languageService
      .loadLanguageSettingFromUserProfile()
      .catch((error) =>
        console.error("言語設定の読み込みに失敗しました:", error),
      );

    // 開発環境でのi18n状態のデバッグログ
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
