import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Button,
  Stack,
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
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
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
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [tokenHistory, setTokenHistory] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [scenarioFilter, setScenarioFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "score">("date-desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const filterInitializedRef = useRef(false);

  // 每页显示数量
  const ITEMS_PER_PAGE = 10;

  // 初始数据加载
  useEffect(() => {
    const initializeData = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          await Promise.all([loadSessions(), loadScenarios()]);
          filterInitializedRef.current = true;
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
    if (!filterInitializedRef.current) return;
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
      const count = response.totalCount ?? response.sessions.length;
      setTotalCount(count);
      setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)));
      setError(null);
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
        setTokenHistory((current) => [...current, nextToken]);
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

  const handleRepeatPractice = (
    event: React.MouseEvent,
    session: SessionInfo,
  ) => {
    event.stopPropagation();
    navigate(`/conversation/${session.scenarioId}`);
  };

  const handleCompleteAndReview = async (
    event: React.MouseEvent,
    session: SessionInfo,
  ) => {
    event.stopPropagation();
    setCompletingSessionId(session.sessionId);
    setError(null);
    try {
      await apiService.completeSession(session.sessionId);
      navigate(`/history/session/${session.sessionId}`);
    } catch (err) {
      console.error("结束会话失败", err);
      setError(t("history.error.completeFailed"));
      setCompletingSessionId(null);
    }
  };

  const renderSessionActions = (session: SessionInfo) => {
    const isCompleted = session.status === "completed";
    const canComplete = !isCompleted && (session.messageCount ?? 0) > 0;
    const isCompleting = completingSessionId === session.sessionId;

    return (
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
        {isCompleted ? (
          <Button
            size="small"
            variant="contained"
            startIcon={<AssessmentRoundedIcon />}
            onClick={(event) => {
              event.stopPropagation();
              handleSessionClick(session.sessionId);
            }}
          >
            {t("history.viewReview")}
          </Button>
        ) : canComplete ? (
          <Button
            size="small"
            variant="contained"
            startIcon={<AssessmentRoundedIcon />}
            disabled={isCompleting}
            onClick={(event) => handleCompleteAndReview(event, session)}
          >
            {isCompleting
              ? t("history.completing")
              : t("history.completeAndReview")}
          </Button>
        ) : null}
        <Button
          size="small"
          variant="outlined"
          startIcon={<ReplayRoundedIcon />}
          onClick={(event) => handleRepeatPractice(event, session)}
        >
          {t("history.repeatPractice")}
        </Button>
      </Stack>
    );
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
        sx={{
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 3.5,
          bgcolor: "background.paper",
          transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
          "&:hover": {
            borderColor: theme.palette.primary.main,
            transform: "translateY(-2px)",
            boxShadow: `0 14px 36px ${alpha(theme.palette.primary.main, 0.1)}`,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: { xs: "wrap", md: "nowrap" },
          }}
        >
          {/* 状态图标 */}
          <Box
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: isCompleted ? "rgba(37,166,106,.10)" : "rgba(43,89,209,.09)",
            }}
          >
            {isCompleted ? (
              <CheckCircleIcon color="success" sx={{ fontSize: 25 }} />
            ) : (
              <PlayCircleOutlineIcon color="primary" sx={{ fontSize: 25 }} />
            )}
          </Box>

          {/* 主内容 */}
          <Box
            sx={{
              flexGrow: 1,
              flexBasis: { xs: "calc(100% - 64px)", md: "auto" },
              minWidth: 0,
            }}
          >
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{
                  flexGrow: 1,
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                }}
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
            {renderSessionActions(session)}
          </Box>

          {/* 分数显示 */}
          {score != null && score > 0 && (
            <Box
              sx={{
                flexShrink: 0,
                textAlign: "center",
                minWidth: 60,
                ml: { xs: 7.5, md: 0 },
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
            <Box sx={{ flexShrink: 0, width: { xs: 112, md: 80 } }}>
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
        sx={{
          p: 2.5,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 3.5,
          bgcolor: "background.paper",
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
            {session.scenarioName || session.title || t("history.untitledSession")}
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
          {renderSessionActions(session)}
        </Box>
      </Paper>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3, lg: 5 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "flex-end" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: { xs: 3, md: 4 },
        }}
      >
        <Box>
          <Typography
            sx={{
              color: "primary.main",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              mb: 1,
            }}
          >
            Practice review
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 32, md: 42 }, mb: 1 }}>
            {t("history.title")}
          </Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {t("history.description")}
          </Typography>
        </Box>
        <Chip
          label={`${totalCount} 次练习`}
          color="primary"
          variant="outlined"
          sx={{ bgcolor: "background.paper", fontWeight: 700 }}
        />
      </Box>

      {/* 筛选与控制 */}
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          gap: 1.5,
          mb: 3,
          flexWrap: "wrap",
          alignItems: "center",
          p: { xs: 1.5, md: 2 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3.5,
          bgcolor: "rgba(255,255,255,.82)",
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
      </Paper>

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
