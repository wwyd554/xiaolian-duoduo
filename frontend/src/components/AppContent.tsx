import React, { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";

// 组件的导入
import Header from "./Header";
import HomePage from "../pages/HomePage";

const ScenarioSelectPage = lazy(() => import("../pages/ScenarioSelectPage"));
const ConversationPage = lazy(() => import("../pages/ConversationPage"));
const ResultPage = lazy(() => import("../pages/ResultPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const SessionHistoryPage = lazy(
  () => import("../pages/history/SessionHistoryPage"),
);
const AudioAnalysisPage = lazy(() => import("../pages/AudioAnalysisPage"));
const AvatarTestPage = lazy(() => import("../pages/AvatarTestPage"));
const ScenarioCreatePage = lazy(
  () => import("../pages/scenarios/ScenarioCreatePage"),
);
const ScenarioEditPage = lazy(
  () => import("../pages/scenarios/ScenarioEditPage"),
);
const ScenarioManagementPage = lazy(
  () => import("../pages/scenarios/management/ScenarioManagementPage"),
);

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  resetKey: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Route rendering failed:", error, errorInfo);
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * 渲染应用主内容的组件
 * 负责管理顶部栏标题，路由委托给 router.tsx
 */
const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isConversationPage = location.pathname.startsWith("/conversation/");
  const isHomePage = location.pathname === "/";
  const isScenarioLibrary = location.pathname === "/scenarios";
  const isShowcasePage = isHomePage || isScenarioLibrary;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  // 根据当前路径决定页面标题
  const getPageTitle = () => {
    const path = location.pathname;

    if (path === "/") return undefined;
    if (path === "/scenarios") return t("scenarios.title");
    if (path === "/scenarios/create") return t("scenarios.create.title");
    if (path.startsWith("/scenarios/edit/")) return t("scenarios.edit.title");
    if (path === "/profile") return t("profile.title");
    if (path === "/history") return t("history.title");
    if (path === "/audio-analysis") return t("audioAnalysis.title");
    if (path === "/avatar-test") return "VRM表情测试";
    if (path.startsWith("/conversation/")) return t("conversation.title");
    if (path.startsWith("/results/")) return t("results.title");
    if (path.startsWith("/history/session/")) return t("history.sessionDetail");
    if (path.startsWith("/session-loading/")) return t("session.loading");

    return undefined;
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isConversationPage
          ? "column"
          : { xs: "column", sm: "row" },
        minHeight: isConversationPage ? "100dvh" : "100vh",
        height: isConversationPage ? "100dvh" : "auto",
        overflow: isConversationPage ? "hidden" : "visible",
      }}
    >
      {!isConversationPage && (
        <Header
          pageTitle={isScenarioLibrary ? undefined : getPageTitle()}
          variant={isHomePage ? "landing" : "app"}
        />
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isConversationPage ? "100%" : "auto",
          py: isConversationPage || isShowcasePage ? 0 : 2,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
          overflowX: isConversationPage ? "hidden" : "clip",
          overflowY: isConversationPage ? "hidden" : "visible",
        }}
      >
        <RouteErrorBoundary
          resetKey={location.pathname}
          fallback={
            <Box
              role="alert"
              sx={{
                flex: 1,
                minHeight: 240,
                display: "grid",
                placeItems: "center",
                color: "text.secondary",
                fontSize: 14,
              }}
            >
              <Box sx={{ textAlign: "center" }}>
                <Box sx={{ mb: 2 }}>{t("common.error_msg")}</Box>
                <Button
                  variant="contained"
                  onClick={() => window.location.reload()}
                >
                  {t("common.retry")}
                </Button>
              </Box>
            </Box>
          }
        >
          <Suspense
            fallback={
              <Box
                role="status"
                aria-live="polite"
                sx={{
                  flex: 1,
                  minHeight: 160,
                  display: "grid",
                  placeItems: "center",
                  color: "text.secondary",
                  fontSize: 14,
                }}
              >
                {t("common.loading")}
              </Box>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/scenarios" element={<ScenarioSelectPage />} />
              <Route
                path="/scenarios/create"
                element={<ScenarioCreatePage />}
              />
              <Route
                path="/scenarios/edit/:scenarioId"
                element={<ScenarioEditPage />}
              />
              <Route
                path="/scenarios/manage"
                element={<ScenarioManagementPage />}
              />
              <Route
                path="/conversation/:scenarioId"
                element={<ConversationPage />}
              />
              <Route path="/result/:sessionId" element={<ResultPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/history" element={<SessionHistoryPage />} />
              <Route
                path="/history/session/:sessionId"
                element={<ResultPage />}
              />
              <Route path="/audio-analysis" element={<AudioAnalysisPage />} />
              <Route path="/avatar-test" element={<AvatarTestPage />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </Box>
    </Box>
  );
};

export default AppContent;
