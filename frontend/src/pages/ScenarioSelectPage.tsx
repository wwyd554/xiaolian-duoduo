import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { SelectChangeEvent } from "@mui/material";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Avatar,
  TextField,
  InputAdornment,
  FormControl,
  MenuItem,
  Select,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Paper,
  Stack,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";

import { ApiService } from "../services/ApiService";
import { AuthService } from "../services/AuthService";
import type { ScenarioInfo, DifficultyLevel } from "../types/api";

const isImageSource = (avatar?: string) =>
  Boolean(
    avatar &&
    (/^(https?:)?\/\//.test(avatar) ||
      avatar.startsWith("/") ||
      avatar.startsWith("data:image/")),
  );

const ScenarioSelectPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  // 难度显示映射
  const DIFFICULTY_DISPLAY_MAPPING: Record<DifficultyLevel, string> = {
    easy: t("scenarios.beginner"),
    normal: t("scenarios.intermediate"),
    hard: t("scenarios.advanced"),
    expert: t("scenarios.advanced"),
  };

  const DIFFICULTY_TONE_MAPPING: Record<
    DifficultyLevel,
    { color: string; backgroundColor: string }
  > = {
    easy: { color: "#28765a", backgroundColor: "#e7f4ed" },
    normal: { color: "#846019", backgroundColor: "#f9f0d9" },
    hard: { color: "#a3473e", backgroundColor: "#f8e8e5" },
    expert: { color: "#843e69", backgroundColor: "#f3e6ef" },
  };

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

  // 难度显示转换函数
  const getDifficultyLabel = (difficulty: DifficultyLevel): string => {
    return DIFFICULTY_DISPLAY_MAPPING[difficulty] || difficulty;
  };

  // 获取当前用户 ID 的函数
  const fetchCurrentUser = React.useCallback(async () => {
    try {
      // 统一从认证服务读取，兼容当前的邀请码/JWT 本地认证和旧 Cognito 模式。
      const user = await AuthService.getInstance().getCurrentUser();
      setCurrentUserId(user?.userId ?? null);
    } catch (err) {
      console.error("用户信息获取错误:", err);
      // 未认证时设置为 null
      setCurrentUserId(null);
    }
  }, []);

  // 判断是否为场景所有者的函数
  const isScenarioOwner = (scenario: ScenarioInfo): boolean => {
    // 未获取到当前用户 ID 时返回 false
    if (!currentUserId) {
      return false;
    }

    // 如果场景有 createdBy 字段则使用它
    if (scenario.createdBy) {
      const isOwner = scenario.createdBy === currentUserId;
      return isOwner;
    }

    // 如果有自定义场景标志则使用它
    if (scenario.isCustom !== undefined) {
      return scenario.isCustom;
    }

    // 回退：场景 ID 中包含 custom 时
    // （为了与现有自定义场景兼容）
    const isCustomScenario = scenario.scenarioId.includes("custom");
    return isCustomScenario;
  };

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

  // 筛选变更处理器
  const handleDifficultyFilterChange = (event: SelectChangeEvent) => {
    setDifficultyFilter(event.target.value);
  };

  const handleCategoryFilterChange = (event: SelectChangeEvent) => {
    setCategoryFilter(event.target.value);
  };

  // 排序方式变更处理器
  const handleSortOrderChange = (event: SelectChangeEvent) => {
    setSortOrder(event.target.value);
  };

  // 收藏切换处理器
  const toggleFavorite = (scenarioId: string) => {
    const newFavorites = favoriteScenarios.includes(scenarioId)
      ? favoriteScenarios.filter((id) => id !== scenarioId)
      : [...favoriteScenarios, scenarioId];

    setFavoriteScenarios(newFavorites);
    localStorage.setItem("favoriteScenarios", JSON.stringify(newFavorites));
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
        minHeight: { xs: "calc(100dvh - 64px)", sm: "100dvh" },
        overflow: "hidden",
        bgcolor: "#f5f6f2",
        "&::before": {
          content: '""',
          position: "absolute",
          width: 520,
          height: 520,
          top: -250,
          right: -180,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(43,89,209,.10) 0%, rgba(43,89,209,0) 70%)",
          pointerEvents: "none",
        },
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1540,
          px: { xs: 2, sm: 3, lg: 4 },
          py: { xs: 2.5, md: 4 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: 2.5, lg: 3 },
          }}
        >
          <Paper
            component="section"
            aria-label={t("scenarios.workspace.libraryTitle")}
            elevation={0}
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: { xs: 1.5, md: 2 },
              p: { xs: 1.5, md: 1.75 },
              border: "1px solid",
              borderColor: "rgba(30,36,48,.08)",
              borderRadius: "18px",
              bgcolor: "rgba(250,251,248,.9)",
              boxShadow: "0 8px 24px rgba(30,36,48,.03)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                flex: { xs: "1 1 100%", sm: "0 0 210px" },
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  color: "primary.main",
                  bgcolor: "rgba(43,89,209,.09)",
                }}
                aria-hidden="true"
              >
                <GridViewRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: 15, fontWeight: 750, lineHeight: 1.35 }}
                >
                  {t("scenarios.workspace.libraryTitle")}
                </Typography>
                <Typography
                  sx={{ mt: 0.15, color: "text.secondary", fontSize: 11 }}
                >
                  {t("scenarios.workspace.librarySubtitle")}
                </Typography>
              </Box>
            </Box>

            <Box
              component="nav"
              aria-label={t("scenarios.workspace.viewAria")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                flex: { xs: "1 1 100%", sm: "1 1 300px", lg: "0 1 330px" },
                minWidth: 0,
                p: 0.5,
                borderRadius: "14px",
                bgcolor: "rgba(30,36,48,.035)",
              }}
            >
              <Button
                disableRipple
                aria-pressed={!showFavoritesOnly}
                onClick={() => setShowFavoritesOnly(false)}
                sx={{
                  flex: 1,
                  width: "auto",
                  minWidth: 0,
                  minHeight: 42,
                  px: 1.25,
                  py: 0.75,
                  justifyContent: "space-between",
                  borderRadius: "11px",
                  color: !showFavoritesOnly ? "text.primary" : "text.secondary",
                  bgcolor: !showFavoritesOnly
                    ? "rgba(43,89,209,.075)"
                    : "transparent",
                  "&:hover": { bgcolor: "rgba(43,89,209,.075)" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <GridViewRoundedIcon
                    sx={{ fontSize: 17 }}
                    aria-hidden="true"
                  />
                  <Typography sx={{ fontSize: 13, fontWeight: 650 }}>
                    {t("scenarios.workspace.allScenarios")}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {scenarios.length}
                </Typography>
              </Button>
              <Button
                disableRipple
                aria-pressed={showFavoritesOnly}
                onClick={() => setShowFavoritesOnly(true)}
                sx={{
                  flex: 1,
                  width: "auto",
                  minWidth: 0,
                  minHeight: 42,
                  px: 1.25,
                  py: 0.75,
                  justifyContent: "space-between",
                  borderRadius: "11px",
                  color: showFavoritesOnly ? "text.primary" : "text.secondary",
                  bgcolor: showFavoritesOnly
                    ? "rgba(43,89,209,.075)"
                    : "transparent",
                  "&:hover": { bgcolor: "rgba(43,89,209,.075)" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <StarRoundedIcon sx={{ fontSize: 17 }} aria-hidden="true" />
                  <Typography sx={{ fontSize: 13, fontWeight: 650 }}>
                    {t("scenarios.workspace.myFavorites")}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {favoriteScenarios.length}
                </Typography>
              </Button>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                flex: { xs: "1 1 100%", md: "0 0 auto" },
                ml: { lg: "auto" },
              }}
            >
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => navigate("/scenarios/create")}
                sx={{
                  flex: { xs: 1, md: "0 0 auto" },
                  minHeight: 42,
                  borderRadius: "12px",
                  fontSize: 12.5,
                }}
              >
                {t("scenarios.create.button")}
              </Button>
              <Button
                variant="text"
                startIcon={<SettingsOutlinedIcon />}
                onClick={() => navigate("/scenarios/manage")}
                sx={{
                  flex: { xs: 1, md: "0 0 auto" },
                  minHeight: 40,
                  color: "text.secondary",
                  borderRadius: "10px",
                  fontSize: 12.5,
                }}
              >
                {t("scenarios.management.button")}
              </Button>
            </Box>

            <Box
              sx={{
                display: { xs: "none", xl: "block" },
                flex: "1 1 260px",
                minWidth: 240,
                pl: 2,
                borderLeft: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  mb: 0.75,
                }}
              >
                <SchoolOutlinedIcon
                  sx={{ color: "primary.main", fontSize: 17 }}
                  aria-hidden="true"
                />
                <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>
                  {t("scenarios.workspace.practiceAdviceTitle")}
                </Typography>
              </Box>
              <Typography
                sx={{ color: "text.secondary", fontSize: 11, lineHeight: 1.65 }}
              >
                {t("scenarios.workspace.practiceAdvice")}
              </Typography>
            </Box>
          </Paper>

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
                gap: 2,
                mb: 2.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
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
                <Typography
                  id="scenario-library-heading"
                  component="h1"
                  sx={{
                    color: "text.primary",
                    fontSize: { xs: 28, md: 36 },
                    fontWeight: 760,
                    letterSpacing: "-.025em",
                    lineHeight: 1.15,
                  }}
                >
                  {t("scenarios.workspace.heading")}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.8,
                    maxWidth: 680,
                    color: "text.secondary",
                    fontSize: { xs: 13, md: 14 },
                    lineHeight: 1.65,
                  }}
                >
                  {t("scenarios.subtitle")}
                </Typography>
              </Box>

              <Tooltip title={t("common.refresh")}>
                <span>
                  <IconButton
                    onClick={() => fetchScenarios()}
                    disabled={loading}
                    aria-label={t("common.refresh")}
                    sx={{
                      width: 42,
                      height: 42,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: "12px",
                      bgcolor: "rgba(255,255,255,.8)",
                      color: "text.secondary",
                      "&:hover": {
                        bgcolor: "background.paper",
                        color: "primary.main",
                      },
                    }}
                  >
                    <RefreshRoundedIcon sx={{ fontSize: 19 }} />
                  </IconButton>
                </span>
              </Tooltip>
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
              <Paper
                elevation={0}
                sx={{
                  mb: 2.5,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 1,
                  p: 1.25,
                  border: "1px solid",
                  borderColor: "rgba(30,36,48,.08)",
                  borderRadius: "18px",
                  bgcolor: "rgba(255,255,255,.78)",
                  boxShadow: "0 8px 24px rgba(30,36,48,.025)",
                }}
              >
                <TextField
                  placeholder={t("scenarios.searchPlaceholder")}
                  variant="outlined"
                  size="small"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  sx={{
                    flex: "1 1 300px",
                    minWidth: { xs: "100%", sm: 240 },
                    "& .MuiOutlinedInput-root": {
                      height: 42,
                      borderRadius: 999,
                      bgcolor: "#f5f6f3",
                    },
                  }}
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("scenarios.searchPlaceholder"),
                    },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon
                            sx={{ color: "text.secondary", fontSize: 19 }}
                          />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <FormControl
                  size="small"
                  sx={{
                    minWidth: 132,
                    flex: { xs: "1 1 132px", md: "0 0 auto" },
                    "& .MuiOutlinedInput-root": {
                      height: 42,
                      borderRadius: 999,
                      bgcolor: "#f5f6f3",
                    },
                  }}
                >
                  <Select
                    value={difficultyFilter}
                    onChange={handleDifficultyFilterChange}
                    displayEmpty
                    inputProps={{
                      "aria-label": t(
                        "scenarios.workspace.difficultyFilterAria",
                      ),
                    }}
                    startAdornment={
                      <TuneRoundedIcon
                        sx={{ mr: 0.75, color: "text.secondary", fontSize: 17 }}
                      />
                    }
                  >
                    {DIFFICULTY_FILTER_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl
                  size="small"
                  sx={{
                    minWidth: 148,
                    flex: { xs: "1 1 148px", md: "0 0 auto" },
                    "& .MuiOutlinedInput-root": {
                      height: 42,
                      borderRadius: 999,
                      bgcolor: "#f5f6f3",
                    },
                  }}
                >
                  <Select
                    value={categoryFilter}
                    onChange={handleCategoryFilterChange}
                    displayEmpty
                    inputProps={{
                      "aria-label": t("scenarios.workspace.categoryFilterAria"),
                    }}
                    startAdornment={
                      <BusinessOutlinedIcon
                        sx={{ mr: 0.75, color: "text.secondary", fontSize: 17 }}
                      />
                    }
                  >
                    <MenuItem value="all">
                      {t("scenarios.filters.allIndustries")}
                    </MenuItem>
                    {categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl
                  size="small"
                  sx={{
                    minWidth: 126,
                    flex: { xs: "1 1 126px", md: "0 0 auto" },
                    "& .MuiOutlinedInput-root": {
                      height: 42,
                      borderRadius: 999,
                      bgcolor: "#f5f6f3",
                    },
                  }}
                >
                  <Select
                    value={sortOrder}
                    onChange={handleSortOrderChange}
                    displayEmpty
                    inputProps={{
                      "aria-label": t("scenarios.workspace.sortAria"),
                    }}
                    startAdornment={
                      <SortRoundedIcon
                        sx={{ mr: 0.75, color: "text.secondary", fontSize: 17 }}
                      />
                    }
                  >
                    <MenuItem value="difficulty">
                      {t("scenarios.sort.byDifficulty")}
                    </MenuItem>
                    <MenuItem value="industry">
                      {t("scenarios.sort.byIndustry")}
                    </MenuItem>
                    <MenuItem value="title">
                      {t("scenarios.sort.byTitle")}
                    </MenuItem>
                  </Select>
                </FormControl>

                <Button
                  variant={showFavoritesOnly ? "contained" : "outlined"}
                  size="small"
                  startIcon={
                    showFavoritesOnly ? (
                      <StarRoundedIcon />
                    ) : (
                      <StarBorderRoundedIcon />
                    )
                  }
                  aria-pressed={showFavoritesOnly}
                  onClick={() => setShowFavoritesOnly((current) => !current)}
                  sx={{
                    minHeight: 42,
                    px: 1.5,
                    borderRadius: 999,
                    borderColor: showFavoritesOnly ? "primary.main" : "divider",
                    color: showFavoritesOnly
                      ? "primary.contrastText"
                      : "text.secondary",
                    fontSize: 12,
                  }}
                >
                  {t("scenarios.filters.favoritesOnly")}
                </Button>

                <Box
                  sx={{
                    ml: { md: "auto" },
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 0.75,
                  }}
                >
                  {hasActiveFilters ? (
                    <Button
                      size="small"
                      onClick={resetFilters}
                      sx={{
                        minWidth: 0,
                        px: 1,
                        color: "text.secondary",
                        fontSize: 11.5,
                      }}
                    >
                      {t("scenarios.workspace.clearFilters")}
                    </Button>
                  ) : null}
                  <Typography
                    sx={{
                      color: "text.secondary",
                      fontSize: 11.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("scenarios.showingItems", {
                      count: sortedScenarios.length,
                    })}
                  </Typography>
                </Box>
              </Paper>
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
                {sortedScenarios.map((scenario) => {
                  const isFavorite = favoriteScenarios.includes(
                    scenario.scenarioId,
                  );
                  const npc = scenario.npcInfo ?? scenario.npc;
                  const difficultyTone =
                    DIFFICULTY_TONE_MAPPING[scenario.difficulty];

                  return (
                    <Card
                      key={scenario.scenarioId}
                      component="article"
                      sx={{
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        border: "1px solid",
                        borderColor: isFavorite
                          ? "rgba(43,89,209,.28)"
                          : "rgba(30,36,48,.085)",
                        borderRadius: "18px",
                        bgcolor: "rgba(255,255,255,.92)",
                        boxShadow: isFavorite
                          ? "0 8px 24px rgba(43,89,209,.065)"
                          : "0 6px 20px rgba(30,36,48,.035)",
                        transition:
                          "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          borderColor: "rgba(43,89,209,.26)",
                          boxShadow: "0 13px 32px rgba(30,36,48,.075)",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                          transition: "none",
                          "&:hover": { transform: "none" },
                        },
                      }}
                    >
                      <CardContent
                        sx={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          p: { xs: 2, md: 2.25 },
                          "&:last-child": { pb: { xs: 2, md: 2.25 } },
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            mb: 1.5,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 0.65,
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                px: 0.9,
                                py: 0.35,
                                borderRadius: 999,
                                bgcolor: "#f0f2ef",
                                color: "text.secondary",
                                fontSize: 10,
                                fontWeight: 650,
                                lineHeight: 1.4,
                              }}
                            >
                              {scenario.category || t("scenarios.industry")}
                            </Box>
                            <Box
                              component="span"
                              sx={{
                                px: 0.9,
                                py: 0.35,
                                borderRadius: 999,
                                color: difficultyTone.color,
                                bgcolor: difficultyTone.backgroundColor,
                                fontSize: 10,
                                fontWeight: 750,
                                lineHeight: 1.4,
                              }}
                            >
                              {getDifficultyLabel(scenario.difficulty)}
                            </Box>
                            {isScenarioOwner(scenario) ? (
                              <Box
                                component="span"
                                sx={{
                                  px: 0.9,
                                  py: 0.35,
                                  borderRadius: 999,
                                  color: "primary.main",
                                  bgcolor: "rgba(43,89,209,.07)",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  lineHeight: 1.4,
                                }}
                              >
                                {t("scenarios.workspace.customBadge")}
                              </Box>
                            ) : null}
                          </Box>

                          <IconButton
                            size="small"
                            onClick={() => toggleFavorite(scenario.scenarioId)}
                            aria-label={
                              isFavorite
                                ? t("scenarios.workspace.removeFavoriteAria")
                                : t("scenarios.workspace.addFavoriteAria")
                            }
                            aria-pressed={isFavorite}
                            sx={{
                              width: 32,
                              height: 32,
                              flexShrink: 0,
                              color: isFavorite ? "#c38a20" : "text.disabled",
                              bgcolor: isFavorite ? "#fbf4df" : "transparent",
                              "&:hover": {
                                bgcolor: "#fbf4df",
                                color: "#c38a20",
                              },
                            }}
                          >
                            {isFavorite ? (
                              <StarRoundedIcon sx={{ fontSize: 18 }} />
                            ) : (
                              <StarBorderRoundedIcon sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </Box>

                        <Typography
                          component="h2"
                          sx={{
                            color: "text.primary",
                            fontSize: 18,
                            fontWeight: 750,
                            lineHeight: 1.4,
                            letterSpacing: "-.012em",
                          }}
                        >
                          {scenario.title}
                        </Typography>
                        <Typography
                          sx={{
                            mt: 0.75,
                            minHeight: 58,
                            color: "text.secondary",
                            fontSize: 12.5,
                            lineHeight: 1.6,
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 3,
                            overflow: "hidden",
                          }}
                        >
                          {scenario.description}
                        </Typography>

                        {npc ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.1,
                              mt: 2,
                              py: 1.35,
                              borderTop: "1px solid",
                              borderBottom: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Avatar
                              src={
                                isImageSource(npc.avatar)
                                  ? npc.avatar
                                  : undefined
                              }
                              sx={{
                                width: 36,
                                height: 36,
                                flexShrink: 0,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: "#eef1f7",
                                color: "text.primary",
                                fontSize: 17,
                              }}
                            >
                              {isImageSource(npc.avatar)
                                ? null
                                : npc.avatar || npc.role?.charAt(0) || "👤"}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                noWrap
                                sx={{
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  lineHeight: 1.45,
                                }}
                              >
                                {npc.name}
                              </Typography>
                              <Typography
                                noWrap
                                sx={{
                                  mt: 0.1,
                                  color: "text.secondary",
                                  fontSize: 10.5,
                                }}
                              >
                                {[npc.role, npc.company]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </Typography>
                            </Box>
                            {npc.personality?.[0] ? (
                              <Typography
                                sx={{
                                  flexShrink: 0,
                                  maxWidth: 76,
                                  color: "text.secondary",
                                  fontSize: 10,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {npc.personality[0]}
                              </Typography>
                            ) : null}
                          </Box>
                        ) : null}

                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 1.5,
                            mt: 1.4,
                            mb: 2,
                            color: "text.secondary",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.55,
                            }}
                          >
                            <TrendingUpRoundedIcon
                              sx={{ fontSize: 15 }}
                              aria-hidden="true"
                            />
                            <Typography sx={{ fontSize: 10.5 }}>
                              {t("scenarios.workspace.goalCount", {
                                count: scenario.goals?.length || 0,
                              })}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.55,
                            }}
                          >
                            <AccessTimeRoundedIcon
                              sx={{ fontSize: 15 }}
                              aria-hidden="true"
                            />
                            <Typography sx={{ fontSize: 10.5 }}>
                              {scenario.estimatedDuration
                                ? t("scenarios.workspace.estimatedDuration", {
                                    minutes: scenario.estimatedDuration,
                                  })
                                : t("scenarios.workspace.defaultDuration")}
                            </Typography>
                          </Box>
                        </Box>

                        <Button
                          variant="contained"
                          fullWidth
                          startIcon={<PlayArrowRoundedIcon />}
                          endIcon={<ChevronRightRoundedIcon />}
                          onClick={() =>
                            navigate(`/conversation/${scenario.scenarioId}`)
                          }
                          aria-label={t("scenarios.workspace.startAria", {
                            title: scenario.title,
                          })}
                          sx={{
                            mt: "auto",
                            minHeight: 42,
                            borderRadius: "12px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            "& .MuiButton-endIcon": { ml: "auto" },
                          }}
                        >
                          {t("scenarios.workspace.startButton")}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            ) : null}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default ScenarioSelectPage;
