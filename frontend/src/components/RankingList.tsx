import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { ApiService } from "../services/ApiService";
import type { RankingEntry, ScenarioInfo } from "../types/api";

interface RankingListProps {
  currentUserId?: string; // 当前用户 ID（可选）
}

const RankingList: React.FC<RankingListProps> = ({ currentUserId }) => {
  const { t } = useTranslation();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);

  const apiService = ApiService.getInstance();

  // 获取场景列表
  const fetchScenarios = useCallback(async () => {
    try {
      const response = await apiService.getScenarios();
      setScenarios(response.scenarios || []);
      // 设置初始选中的场景
      if (response.scenarios && response.scenarios.length > 0) {
        setSelectedScenario(response.scenarios[0].scenarioId);
      }
    } catch (err) {
      setError(t("common.errorFetchingScenarios"));
      console.error("场景获取错误:", err);
    }
  }, [apiService, t]);

  // 获取排行榜数据
  const fetchRankings = useCallback(async () => {
    if (!selectedScenario) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getRankings(
        selectedScenario,
        selectedPeriod,
        10,
      );
      if (response && response.rankings) {
        setRankings(response.rankings || []);
        // 使用 totalCount 字段
        setTotalParticipants(response.totalCount || 0);
      } else {
        setError(t("errors.server"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.server"));
      console.error("排行榜获取错误:", err);
    } finally {
      setLoading(false);
    }
  }, [apiService, selectedScenario, selectedPeriod, t]);

  // 场景选择的变更处理器
  const handleScenarioChange = (event: SelectChangeEvent) => {
    setSelectedScenario(event.target.value);
  };

  // 期间选择的变更处理器
  const handlePeriodChange = (event: SelectChangeEvent) => {
    setSelectedPeriod(event.target.value as "daily" | "weekly" | "monthly");
  };

  // 组件挂载时获取场景列表
  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  // 场景或期间变化时重新获取排行榜
  useEffect(() => {
    if (selectedScenario) {
      fetchRankings();
    }
  }, [selectedScenario, selectedPeriod, fetchRankings]);

  // 获取当前选中的场景名称
  const getSelectedScenarioName = () => {
    const scenario = scenarios.find((s) => s.scenarioId === selectedScenario);
    return scenario ? scenario.title : "";
  };

  // 获取期间显示的字符串
  const getPeriodDisplayText = () => {
    switch (selectedPeriod) {
      case "daily":
        return t("ranking.daily");
      case "weekly":
        return t("ranking.weekly");
      case "monthly":
        return t("ranking.monthly");
      default:
        return "";
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 800, mx: "auto", p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        {/* 场景选择 */}
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="scenario-select-label">
            {t("ranking.scenario")}
          </InputLabel>
          <Select
            labelId="scenario-select-label"
            id="scenario-select"
            value={selectedScenario}
            label={t("ranking.scenario")}
            onChange={handleScenarioChange}
          >
            {scenarios.map((scenario) => (
              <MenuItem key={scenario.scenarioId} value={scenario.scenarioId}>
                {scenario.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 期間選択 */}
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="period-select-label">
            {t("ranking.period")}
          </InputLabel>
          <Select
            labelId="period-select-label"
            id="period-select"
            value={selectedPeriod}
            label={t("ranking.period")}
            onChange={handlePeriodChange}
          >
            <MenuItem value="daily">{t("ranking.daily")}</MenuItem>
            <MenuItem value="weekly">{t("ranking.weekly")}</MenuItem>
            <MenuItem value="monthly">{t("ranking.monthly")}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* 排行榜标题 */}
      <Typography variant="h5" gutterBottom>
        {getSelectedScenarioName()} - {getPeriodDisplayText()}
      </Typography>

      {/* 参加者数 */}
      <Typography variant="subtitle1" gutterBottom>
        {t("ranking.totalParticipants")}: {totalParticipants}
      </Typography>

      {/* 错误显示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 加载显示 */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* 排行榜表格 */
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table aria-label="ranking table">
            <TableHead>
              <TableRow>
                <TableCell align="center">{t("ranking.rank")}</TableCell>
                <TableCell>{t("ranking.user")}</TableCell>
                <TableCell align="right">{t("ranking.score")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.length > 0 ? (
                rankings.map((entry) => (
                  <TableRow
                    key={entry.sessionId}
                    sx={{
                      "&:last-child td, &:last-child th": { border: 0 },
                      // 高亮当前用户所在行
                      ...(currentUserId &&
                        entry.username === currentUserId && {
                          backgroundColor: "primary.light",
                          "&:hover": {
                            backgroundColor: "primary.light",
                          },
                        }),
                    }}
                  >
                    <TableCell align="center">{entry.rank}</TableCell>
                    <TableCell>{entry.username}</TableCell>
                    <TableCell align="right">{entry.score}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    {t("ranking.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default RankingList;
