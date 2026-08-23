import type { Theme } from "@mui/material/styles";

// 响应式设计的辅助函数
export const getResponsiveStyles = (theme: Theme) => {
  return {
    // 页面头部用的响应式样式
    pageHeader: {
      [theme.breakpoints.down("sm")]: {
        fontSize: "2rem", // 移动端使用较小字号
        marginBottom: theme.spacing(2),
      },
    },

    // 卡片网格用的响应式样式
    cardGrid: {
      [theme.breakpoints.down("md")]: {
        flexDirection: "column",
      },
      [theme.breakpoints.down("sm")]: {
        margin: theme.spacing(1),
      },
    },

    // 对话界面用的响应式样式
    conversationLayout: {
      [theme.breakpoints.down("md")]: {
        flexDirection: "column",
      },
    },

    // 对话界面的 NPC 卡片用的响应式样式
    npcCard: {
      [theme.breakpoints.down("md")]: {
        maxWidth: "100%",
        marginBottom: theme.spacing(2),
      },
    },

    // 对话界面的聊天区域用的响应式样式
    chatArea: {
      [theme.breakpoints.down("md")]: {
        maxWidth: "100%",
        height: "300px",
      },
    },

    // 对话输入区域用的响应式样式
    inputArea: {
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
        alignItems: "stretch",
      },
    },

    // 按钮组用的响应式样式
    buttonGroup: {
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
        gap: theme.spacing(1),
        width: "100%",
      },
    },

    // 结果界面用的响应式样式
    resultLayout: {
      [theme.breakpoints.down("md")]: {
        flexDirection: "column",
      },
    },
  };
};

// 按设备调整内边距的辅助函数
export const getDevicePadding = (theme: Theme) => {
  return {
    desktop: theme.spacing(4), // 桌面端留出充足空间
    tablet: theme.spacing(3), // 平板端稍微减少空间
    mobile: theme.spacing(2), // 移动端使用最小内边距
  };
};

// 根据屏幕尺寸调整字体大小的辅助函数
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
