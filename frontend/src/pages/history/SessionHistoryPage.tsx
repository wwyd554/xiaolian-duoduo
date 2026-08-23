import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Pagination,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  SelectChangeEvent,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  alpha,
  useTheme,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonIcon from "@mui/icons-material/Person";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import SortIcon from "@mui/icons-material/Sort";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import { useNavigate } from "react-router-dom";
import { ApiService } from "../../services/ApiService";
import { SessionInfo, ScenarioInfo } from "../../types/api";
import { AuthService } from "../../services/AuthService";

/**
 * 会话历史列表页面（重新设计版）
 * 显示用户的过往对话会话列表
 */
const SessionHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const apiService = ApiService.getInstance();
  const authService = AuthService.getInstance();

  // 状态管理
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [tokenHistory, setTokenHistory] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [scenarioFilter, setScenarioFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "score">("date-desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // 每页显示数量
  const ITEMS_PER_PAGE = 10;

  // 初始数据加载
  useEffect(() => {
    const initializeData = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          loadSessions();
          loadScenarios();
        }
      } catch (error) {
        console.error("用户信息获取失败:", error);
        setError(t("history.error.userLoadFailed"));
      }
    };

    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 场景筛选器变更时
  useEffect(() => {
    setPage(1);
    setNextToken(undefined);
    setTokenHistory([undefined]);
    loadSessions(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioFilter]);

  // 加载会话列表
  const loadSessions = async (token?: string) => {
    setLoading(true);
    try {
      const response = await apiService.getSessions(
        ITEMS_PER_PAGE,
        token,
        scenarioFilter,
      );
      setSessions(response.sessions);
      setNextToken(response.nextToken);

      if (page === 1 && !token) {
        setTotalPages(
          response.nextToken
            ? Math.max(2, Math.ceil(response.sessions.length / ITEMS_PER_PAGE))
            : 1,
        );
      }
    } catch (err) {
      console.error("会话历史加载失败", err);
      setError(t("history.error.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  // 加载场景列表
  const loadScenarios = async () => {
    try {
      const response = await apiService.getScenarios();
      setScenarios(response.scenarios);
    } catch (err) {
      console.error("场景列表加载失败", err);
    }
  };

  // 页码变更处理器
  const handlePageChange = (
    _event: React.ChangeEvent<unknown>,
    newPage: number,
  ) => {
    if (newPage > page) {
      if (nextToken) {
        setPage(newPage);
        loadSessions(nextToken);
        setTokenHistory([...tokenHistory, nextToken]);
      }
    } else if (newPage < page) {
      const previousToken = tokenHistory[newPage - 1];
      setPage(newPage);
      loadSessions(previousToken);
    }
  };

  // 跳转到会话详情页
  const handleSessionClick = (sessionId: string) => {
    navigate(`/history/session/${sessionId}`);
  };

  // 筛选器处理器
  const handleScenarioFilterChange = (event: SelectChangeEvent<string>) => {
    setScenarioFilter(event.target.value);
  };

  // 搜索处理器
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // 日期格式化函数
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "-";
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "-";
    }
  };

  // 相对时间格式化
  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffMin < 1) return "刚刚";
      if (diffMin < 60) return `${diffMin}分钟前`;
      if (diffHour < 24) return `${diffHour}小时前`;
      if (diffDay < 7) return `${diffDay}天前`;
      return "";
    } catch {
      return "";
    }
  };

  // 时长格式化
  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const min = Math.floor(seconds / 60);
    if (min < 1) return "不足 1 分钟";
    if (min < 60) return `${min}分钟`;
    const hour = Math.floor(min / 60);
    const remainMin = min % 60;
    return `${hour}小时${remainMin > 0 ? `${remainMin}分钟` : ""}`;
  };

  // 分数的颜色
  const getScoreColor = (score: number): string => {
    if (score >= 80) return theme.palette.success.main;
    if (score >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  // 用于显示的经过筛选和排序的会话列表
  const filteredSessions = useMemo(() => {
    let result = sessions.filter(
      (session) =>
        (session.title || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (session.npcInfo?.name &&
          session.npcInfo.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase())),
    );

    if (sortBy === "score") {
      result = [...result].sort(
        (a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0),
      );
    } else if (sortBy === "date-desc") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.createdAt || "").getTime() -
          new Date(a.createdAt || "").getTime(),
      );
    } else if (sortBy === "date-asc") {
      result = [...result].sort(
        (a, b) =>
          new Date(a.createdAt || "").getTime() -
          new Date(b.createdAt || "").getTime(),
      );
    }

    return result;
  }, [sessions, searchQuery, sortBy]);

  // 列表项渲染
  const renderListItem = (session: SessionInfo) => {
    const score = session.scores?.overall;
    const relTime = formatRelativeTime(session.createdAt || "");
    const duration = formatDuration(session.duration);
    const isCompleted = session.status === "completed";

    return (
      <Paper
        key={session.sessionId}
        elevation={0}
        onClick={() => handleSessionClick(session.sessionId)}
        sx={{
          p: 2,
          mb: 1.5,
          cursor: "pointer",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          transition: "all 0.15s ease",
          "&:hover": {
            borderColor: theme.palette.primary.main,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {/* 状态图标 */}
          <Box sx={{ flexShrink: 0 }}>
            {isCompleted ? (
              <CheckCircleIcon color="success" sx={{ fontSize: 28 }} />
            ) : (
              <PlayCircleOutlineIcon color="primary" sx={{ fontSize: 28 }} />
            )}
          </Box>

          {/* 主内容 */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                noWrap
                sx={{ flexGrow: 1 }}
              >
                {session.scenarioName || session.title || t("history.untitledSession")}
              </Typography>
              <Chip
                label={isCompleted ? t("history.completed") : t("history.active")}
                color={isCompleted ? "success" : "primary"}
                size="small"
                variant={isCompleted ? "filled" : "outlined"}
                sx={{ fontSize: "0.7rem", height: 22 }}
              />
            </Box>

            {/* 元信息行 */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                flexWrap: "wrap",
                color: "text.secondary",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PersonIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2">
                  {session.npcInfo?.name || t("history.unknownNPC")}
                  {session.npcInfo?.role && (
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.disabled"
                    >
                      {" "}
                      ({session.npcInfo.role})
                    </Typography>
                  )}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CalendarTodayIcon sx={{ fontSize: 14 }} />
                <Typography variant="body2">
                  {formatDate(session.createdAt || "")}
                </Typography>
                {relTime && (
                  <Typography variant="caption" color="text.disabled">
                    ({relTime})
                  </Typography>
                )}
              </Box>

              {session.messageCount != null && session.messageCount > 0 && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />
                  <Typography variant="body2">
                    {session.messageCount}
                  </Typography>
                </Box>
              )}

              {duration && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TimerOutlinedIcon sx={{ fontSize: 14 }} />
                  <Typography variant="body2">{duration}</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* 分数显示 */}
          {score != null && score > 0 && (
            <Box
              sx={{
                flexShrink: 0,
                textAlign: "center",
                minWidth: 60,
              }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ color: getScoreColor(score), lineHeight: 1 }}
              >
                {score}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.65rem" }}
              >
                分数
              </Typography>
            </Box>
          )}

          {/* 指标迷你条 */}
          {session.metrics && (
            <Box sx={{ flexShrink: 0, width: 80 }}>
              <Tooltip title={`信任度: ${session.metrics.trustLevel}/10`}>
                <Box sx={{ mb: 0.5 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.6rem" }}
                  >
                    信任
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={session.metrics.trustLevel * 10}
                    color="success"
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Box>
              </Tooltip>
              <Tooltip title={`进度: ${session.metrics.progressLevel}/10`}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.6rem" }}
                  >
                    进度
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={session.metrics.progressLevel * 10}
                    color="primary"
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Box>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Paper>
    );
  };

  // 网格项渲染
  const renderGridItem = (session: SessionInfo) => {
    const score = session.scores?.overall;
    const isCompleted = session.status === "completed";

    return (
      <Paper
        key={session.sessionId}
        elevation={0}
        onClick={() => handleSessionClick(session.sessionId)}
        sx={{
          p: 2.5,
          cursor: "pointer",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.15s ease",
          "&:hover": {
            borderColor: theme.palette.primary.main,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.12)}`,
          },
        }}
      >
        {/* 页头 */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 1.5,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flexGrow: 1 }}>
            {session.title || t("history.untitledSession")}
          </Typography>
          <Chip
            label={isCompleted ? t("history.completed") : t("history.active")}
            color={isCompleted ? "success" : "primary"}
            size="small"
            variant={isCompleted ? "filled" : "outlined"}
            sx={{ fontSize: "0.7rem", height: 22, ml: 1 }}
          />
        </Box>

        {/* NPC 信息 */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1, color: "text.secondary" }}>
          <PersonIcon sx={{ fontSize: 16 }} />
          <Typography variant="body2" noWrap>
            {session.npcInfo?.name || t("history.unknownNPC")} ({session.npcInfo?.role || ""})
          </Typography>
        </Box>

        {/* 日期时间 */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5, color: "text.secondary" }}>
          <CalendarTodayIcon sx={{ fontSize: 14 }} />
          <Typography variant="body2">
            {formatDate(session.createdAt || "")}
          </Typography>
        </Box>

        {/* 分数与指标 */}
        <Box sx={{ mt: "auto" }}>
          {score != null && score > 0 && (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  分数
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ color: getScoreColor(score) }}
                >
                  {score}/100
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={score}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(getScoreColor(score), 0.15),
                  "& .MuiLinearProgress-bar": {
                    bgcolor: getScoreColor(score),
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          )}

          {/* 底部元信息 */}
          <Box sx={{ display: "flex", gap: 1.5, color: "text.disabled", mt: 1 }}>
            {session.messageCount != null && session.messageCount > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 13 }} />
                <Typography variant="caption">{session.messageCount}</Typography>
              </Box>
            )}
            {session.duration != null && session.duration > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                <TimerOutlinedIcon sx={{ fontSize: 13 }} />
                <Typography variant="caption">{formatDuration(session.duration)}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Paper>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      {/* 筛选与控制 */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 3,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <TextField
          label={t("history.search")}
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t("history.searchPlaceholder")}
          sx={{ flex: "1 1 250px", maxWidth: 350 }}
        />

        <FormControl size="small" sx={{ flex: "1 1 200px", maxWidth: 250 }}>
          <InputLabel id="scenario-filter-label">
            {t("history.scenarioFilter")}
          </InputLabel>
          <Select
            labelId="scenario-filter-label"
            value={scenarioFilter}
            onChange={handleScenarioFilterChange}
            label={t("history.scenarioFilter")}
          >
            <MenuItem value="">{t("history.allScenarios")}</MenuItem>
            {scenarios.map((scenario) => (
              <MenuItem key={scenario.scenarioId} value={scenario.scenarioId}>
                {scenario.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
          <Tooltip title={
            sortBy === "date-desc" ? "最新优先" :
              sortBy === "date-asc" ? "最旧优先" : "按分数排序"
          }>
            <IconButton
              size="small"
              onClick={() => {
                if (sortBy === "date-desc") setSortBy("date-asc");
                else if (sortBy === "date-asc") setSortBy("score");
                else setSortBy("date-desc");
              }}
              color={sortBy === "score" ? "primary" : "default"}
            >
              <SortIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_e, val) => val && setViewMode(val)}
            size="small"
          >
            <ToggleButton value="list" aria-label="列表显示">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="grid" aria-label="网格显示">
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* 排序显示 */}
      {sortBy !== "date-desc" && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          {sortBy === "date-asc" ? "正在按最旧优先显示" : "正在按分数排序显示"}
        </Typography>
      )}

      {/* 错误提示 */}
      {error && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* 加载提示 */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredSessions.length === 0 ? (
        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="h6">{t("history.noSessions")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t("history.startNewSession")}
          </Typography>
        </Box>
      ) : (
        <>
          {/* 会话列表 */}
          {viewMode === "list" ? (
            <Box>{filteredSessions.map(renderListItem)}</Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "1fr 1fr",
                  lg: "1fr 1fr 1fr",
                },
                gap: 2,
              }}
            >
              {filteredSessions.map(renderGridItem)}
            </Box>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default SessionHistoryPage;
