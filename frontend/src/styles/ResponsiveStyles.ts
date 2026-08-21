import type { Theme } from "@mui/material/styles";

// レスポンシブデザインのためのヘルパー関数
export const getResponsiveStyles = (theme: Theme) => {
  return {
    // ページヘッダー用レスポンシブスタイル
    pageHeader: {
      [theme.breakpoints.down("sm")]: {
        fontSize: "2rem", // モバイルでは小さめに
        marginBottom: theme.spacing(2),
      },
    },

    // カードグリッド用レスポンシブスタイル
    cardGrid: {
      [theme.breakpoints.down("md")]: {
        flexDirection: "column",
      },
      [theme.breakpoints.down("sm")]: {
        margin: theme.spacing(1),
      },
    },

    // 対話画面用レスポンシブスタイル
    conversationLayout: {
      [theme.breakpoints.down("md")]: {
        flexDirection: "column",
      },
    },

    // 対話画面のNPCカード用レスポンシブスタイル
    npcCard: {
      [theme.breakpoints.down("md")]: {
        maxWidth: "100%",
        marginBottom: theme.spacing(2),
      },
    },

    // 対話画面のチャットエリア用レスポンシブスタイル
    chatArea: {
      [theme.breakpoints.down("md")]: {
        maxWidth: "100%",
        height: "300px",
      },
    },

    // 対話入力エリア用レスポンシブスタイル
    inputArea: {
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
        alignItems: "stretch",
      },
    },

    // ボタングループ用レスポンシブスタイル
    buttonGroup: {
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
        gap: theme.spacing(1),
        width: "100%",
      },
    },

    // 結果画面用レスポンシブスタイル
    resultLayout: {
      [theme.breakpoints.down("md")]: {
        flexDirection: "column",
      },
    },
  };
};

// デバイスごとのパディング調整用ヘルパー関数
export const getDevicePadding = (theme: Theme) => {
  return {
    desktop: theme.spacing(4), // デスクトップは余裕を持たせる
    tablet: theme.spacing(3), // タブレットは少し余裕を減らす
    mobile: theme.spacing(2), // モバイルは最小限のパディング
  };
};

// スクリーンサイズに応じたフォントサイズ調整用ヘルパー関数
export const getResponsiveFontSizes = (theme: Theme) => {
  return {
    h1: {
      [theme.breakpoints.down("md")]: {
        fontSize: "2.5rem",
      },
      [theme.breakpoints.down("sm")]: {
        fontSize: "2rem",
      },
    },
    h2: {
      [theme.breakpoints.down("md")]: {
        fontSize: "2rem",
      },
      [theme.breakpoints.down("sm")]: {
        fontSize: "1.75rem",
      },
    },
    body1: {
      [theme.breakpoints.down("sm")]: {
        fontSize: "0.95rem",
      },
    },
  };
};
