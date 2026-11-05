import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Stack,
  Snackbar,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ScenarioPromptComposer from "./scenarios/ScenarioPromptComposer";
import { designTokens as d } from "../theme/designTokens";
import WorkspaceBackground from "../components/home/WorkspaceBackground";

import ScenarioFilterBar from "./scenarios/ScenarioFilterBar";
import PracticeScenarioCard from "./scenarios/PracticeScenarioCard";

import { ApiService } from "../services/ApiService";
import { AuthService } from "../services/AuthService";
import type { ScenarioInfo, DifficultyLevel } from "../types/api";

const ScenarioSelectPage: React.FC<{ workspaceHome?: boolean }> = ({
  workspaceHome = false,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("difficulty");
  const [favoriteScenarios, setFavoriteScenarios] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const apiService = ApiService.getInstance();

  // 获取行业列表（基于 API 获取的场景）
  const categories = Array.from(
    new Set(scenarios.map((s) => s.category)),
  ).sort();

  // 难度映射定义
  const DIFFICULTY_MAPPING: Record<string, DifficultyLevel[]> = {
    easy: ["easy"],
    normal: ["normal"],
    hard: ["hard", "expert"],
  };

  // 难度筛选选项
  const DIFFICULTY_FILTER_OPTIONS = [
    { value: "all", label: t("scenarios.filters.allLevels") },
    { value: "easy", label: t("scenarios.beginner") },
    { value: "normal", label: t("scenarios.intermediate") },
    { value: "hard", label: t("scenarios.advanced") },
  ];

  // 从 API 获取场景数据的函数
  const fetchScenarios = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getScenarios();
      if (response.scenarios) {
        setScenarios(response.scenarios);
      } else {
        setError(t("errors.noScenarios"));
      }
    } catch (err) {
      console.error("场景获取错误:", err);
      setError(
        err instanceof Error ? err.message : t("errors.failedToLoadScenarios"),
      );
    } finally {
      setLoading(false);
    }
  }, [apiService, t]);

  // 获取当前用户 ID 的函数
  const fetchCurrentUser = React.useCallback(async () => {
    try {
      // 统一从认证服务读取，兼容当前的邀请码/JWT 本地认证和旧 Cognito 模式。
      const authService = AuthService.getInstance();
      const [user, admin] = await Promise.all([
        authService.getCurrentUser(),
        authService.isAdmin(),
      ]);
      setCurrentUserId(user?.userId ?? null);
      setIsAdmin(admin);
    } catch (err) {
      console.error("用户信息获取错误:", err);
      // 未认证时设置为 null
      setCurrentUserId(null);
    }
  }, []);

  // 初始化
  useEffect(() => {
    // 从本地存储读取收藏
    const storedFavorites = localStorage.getItem("favoriteScenarios");
    if (storedFavorites) {
      setFavoriteScenarios(JSON.parse(storedFavorites));
    }

    // 用户信息与场景列表互不依赖，可并行加载。
    const initializeData = async () => {
      await Promise.all([fetchCurrentUser(), fetchScenarios()]);
    };

    initializeData();
  }, [fetchScenarios, fetchCurrentUser]);

  // 收藏切换处理器
  const toggleFavorite = (scenarioId: string) => {
    const newFavorites = favoriteScenarios.includes(scenarioId)
      ? favoriteScenarios.filter((id) => id !== scenarioId)
      : [...favoriteScenarios, scenarioId];

    setFavoriteScenarios(newFavorites);
    localStorage.setItem("favoriteScenarios", JSON.stringify(newFavorites));
  };

  const handleScenarioDeleted = (scenarioId: string) => {
    setScenarios((current) =>
      current.filter((scenario) => scenario.scenarioId !== scenarioId),
    );
    const remainingFavorites = favoriteScenarios.filter(
      (id) => id !== scenarioId,
    );
    setFavoriteScenarios(remainingFavorites);
    try {
      localStorage.setItem(
        "favoriteScenarios",
        JSON.stringify(remainingFavorites),
      );
    } catch (err) {
      console.warn("收藏状态未能保存", err);
    }
    setDeleteSuccess(true);
  };

  // 筛选场景
  const filteredScenarios = scenarios.filter((scenario) => {
    // 按搜索关键词筛选
    const matchesSearch =
      searchQuery === "" ||
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (scenario.category &&
        scenario.category.toLowerCase().includes(searchQuery.toLowerCase()));

    // 按难度筛选
    const matchesDifficulty =
      difficultyFilter === "all" ||
      (DIFFICULTY_MAPPING[
        difficultyFilter as keyof typeof DIFFICULTY_MAPPING
      ] &&
        DIFFICULTY_MAPPING[
          difficultyFilter as keyof typeof DIFFICULTY_MAPPING
        ].includes(scenario.difficulty));

    // 按行业筛选
    const matchesCategory =
      categoryFilter === "all" || scenario.category === categoryFilter;

    // 按收藏筛选
    const matchesFavorites =
      !showFavoritesOnly || favoriteScenarios.includes(scenario.scenarioId);

    return (
      matchesSearch && matchesDifficulty && matchesCategory && matchesFavorites
    );
  });

  // 对场景排序
  const sortedScenarios = [...filteredScenarios].sort((a, b) => {
    // 将收藏置顶
    if (
      favoriteScenarios.includes(a.scenarioId) &&
      !favoriteScenarios.includes(b.scenarioId)
    )
      return -1;
    if (
      !favoriteScenarios.includes(a.scenarioId) &&
      favoriteScenarios.includes(b.scenarioId)
    )
      return 1;

    // 按所选排序方式进一步排序
    switch (sortOrder) {
      case "difficulty": {
        const difficultyOrder: Record<DifficultyLevel, number> = {
          easy: 0,
          normal: 1,
          hard: 2,
          expert: 3,
        };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      }
      case "industry":
        return (a.category || "").localeCompare(b.category || "");
      case "title":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const hasActiveFilters =
    searchQuery !== "" ||
    difficultyFilter !== "all" ||
    categoryFilter !== "all" ||
    showFavoritesOnly;

  const resetFilters = () => {
    setSearchQuery("");
    setDifficultyFilter("all");
    setCategoryFilter("all");
    setShowFavoritesOnly(false);
  };

  return (
    <Box
      sx={{
        position: "relative",
        isolation: "isolate",
        minHeight: { xs: "calc(100dvh - 64px)", sm: "100dvh" },
        background: workspaceHome ? "transparent" : d.colors.canvas,
      }}
    >
      {workspaceHome && <WorkspaceBackground />}
      <Container
        maxWidth={false}
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1360,
          px: { xs: 2, sm: 3, lg: 4 },
          py: { xs: 2, md: 3 },
        }}
      >
        {workspaceHome && <ScenarioPromptComposer />}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: 2.5, lg: 3 },
          }}
        >
          <Box
            component="section"
            aria-labelledby="scenario-library-heading"
            sx={{ minWidth: 0 }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
                mb: 2.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                {!workspaceHome && (
                  <Typography
                    sx={{
                      color: "primary.main",
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      mb: 0.75,
                    }}
                  >
                    {t("scenarios.workspace.eyebrow")}
                  </Typography>
                )}
                <Typography
                  id="scenario-library-heading"
                  component={workspaceHome ? "h2" : "h1"}
                  sx={{
                    color: "text.primary",
                    fontSize: workspaceHome
                      ? { xs: 21, md: 24 }
                      : { xs: 28, md: 36 },
                    fontWeight: 700,
                    letterSpacing: "-.025em",
                    lineHeight: 1.15,
                  }}
                >
                  {workspaceHome
                    ? t("scenarios.composer.libraryHeading")
                    : t("scenarios.workspace.heading")}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.8,
                    maxWidth: 680,
                    color: d.colors.muted,
                    fontSize: { xs: 14, md: 15 },
                    lineHeight: 1.65,
                  }}
                >
                  {t("scenarios.subtitle")}
                </Typography>
              </Box>
            </Box>
            {error ? (
              <Alert
                severity="error"
                sx={{ mb: 2.5, borderRadius: "14px" }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => fetchScenarios()}
                  >
                    {t("common.retry")}
                  </Button>
                }
              >
                {error}
              </Alert>
            ) : null}

            {!loading && !error ? (
              <ScenarioFilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                difficulty={difficultyFilter}
                onDifficultyChange={setDifficultyFilter}
                difficultyOptions={DIFFICULTY_FILTER_OPTIONS}
                category={categoryFilter}
                categories={categories}
                onCategoryChange={setCategoryFilter}
                sortOrder={sortOrder}
                onSortChange={setSortOrder}
                favoritesOnly={showFavoritesOnly}
                onToggleFavorites={() =>
                  setShowFavoritesOnly((current) => !current)
                }
                resultCount={sortedScenarios.length}
                hasActiveFilters={hasActiveFilters}
                onReset={resetFilters}
              />
            ) : null}

            {loading ? (
              <Paper
                elevation={0}
                role="status"
                aria-live="polite"
                sx={{
                  minHeight: 360,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid",
                  borderColor: "rgba(30,36,48,.08)",
                  borderRadius: "18px",
                  bgcolor: "rgba(255,255,255,.68)",
                }}
              >
                <Stack alignItems="center" spacing={1.25}>
                  <CircularProgress size={28} thickness={4} />
                  <Typography sx={{ color: "text.secondary", fontSize: 12.5 }}>
                    {t("scenarios.workspace.loading")}
                  </Typography>
                </Stack>
              </Paper>
            ) : null}

            {!loading && !error && filteredScenarios.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  minHeight: 320,
                  display: "grid",
                  placeItems: "center",
                  px: 3,
                  border: "1px dashed",
                  borderColor: "rgba(98,105,120,.28)",
                  borderRadius: "18px",
                  bgcolor: "rgba(255,255,255,.55)",
                  textAlign: "center",
                }}
              >
                <Box>
                  <SearchRoundedIcon
                    sx={{ mb: 1.25, color: "text.disabled", fontSize: 34 }}
                    aria-hidden="true"
                  />
                  <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
                    {t("scenarios.noMatchingScenarios")}
                  </Typography>
                  <Typography
                    sx={{ mt: 0.6, color: "text.secondary", fontSize: 12.5 }}
                  >
                    {t("scenarios.noMatchingScenariosHint")}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={resetFilters}
                    sx={{ mt: 2, minHeight: 38, px: 2.25, borderRadius: 999 }}
                  >
                    {t("scenarios.resetFilters")}
                  </Button>
                </Box>
              </Paper>
            ) : null}

            {!loading && !error && sortedScenarios.length > 0 ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                  gap: { xs: 1.5, md: 2 },
                }}
              >
                {sortedScenarios.map((scenario) => (
                  <PracticeScenarioCard
                    key={scenario.scenarioId}
                    scenario={scenario}
                    favorite={favoriteScenarios.includes(scenario.scenarioId)}
                    canEdit={
                      Boolean(currentUserId) &&
                      (scenario.createdBy === "system"
                        ? isAdmin
                        : scenario.createdBy === currentUserId)
                    }
                    canDelete={
                      Boolean(currentUserId) &&
                      scenario.createdBy !== "system" &&
                      scenario.createdBy === currentUserId
                    }
                    onToggleFavorite={() => toggleFavorite(scenario.scenarioId)}
                    onDeleted={handleScenarioDeleted}
                  />
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      </Container>
      <Snackbar
        open={deleteSuccess}
        autoHideDuration={4000}
        onClose={() => setDeleteSuccess(false)}
      >
        <Alert
          severity="success"
          onClose={() => setDeleteSuccess(false)}
          sx={{ borderRadius: "12px" }}
        >
          {t("scenarios.management.deleteSuccess")}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ScenarioSelectPage;
