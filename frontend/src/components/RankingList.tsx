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
  currentUserId?: string; // 現在のユーザーID（オプション）
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

  // シナリオ一覧の取得
  const fetchScenarios = useCallback(async () => {
    try {
      const response = await apiService.getScenarios();
      setScenarios(response.scenarios || []);
      // 初期選択のシナリオをセット
      if (response.scenarios && response.scenarios.length > 0) {
        setSelectedScenario(response.scenarios[0].scenarioId);
      }
    } catch (err) {
      setError(t("common.errorFetchingScenarios"));
      console.error("シナリオ取得エラー:", err);
    }
  }, [apiService, t]);

  // ランキングデータの取得
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
        // totalCountフィールドを使用
        setTotalParticipants(response.totalCount || 0);
      } else {
        setError(t("errors.server"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.server"));
      console.error("ランキング取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [apiService, selectedScenario, selectedPeriod, t]);

  // シナリオ選択の変更ハンドラ
  const handleScenarioChange = (event: SelectChangeEvent) => {
    setSelectedScenario(event.target.value);
  };

  // 期間選択の変更ハンドラ
  const handlePeriodChange = (event: SelectChangeEvent) => {
    setSelectedPeriod(event.target.value as "daily" | "weekly" | "monthly");
  };

  // コンポーネントのマウント時にシナリオ一覧を取得
  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  // シナリオまたは期間が変更されたらランキングを再取得
  useEffect(() => {
    if (selectedScenario) {
      fetchRankings();
    }
  }, [selectedScenario, selectedPeriod, fetchRankings]);

  // 選択中のシナリオ名を取得
  const getSelectedScenarioName = () => {
    const scenario = scenarios.find((s) => s.scenarioId === selectedScenario);
    return scenario ? scenario.title : "";
  };

  // 期間表示用の文字列を取得
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
        {/* シナリオ選択 */}
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

      {/* ランキングタイトル */}
      <Typography variant="h5" gutterBottom>
        {getSelectedScenarioName()} - {getPeriodDisplayText()}
      </Typography>

      {/* 参加者数 */}
      <Typography variant="subtitle1" gutterBottom>
        {t("ranking.totalParticipants")}: {totalParticipants}
      </Typography>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ローディング表示 */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* ランキングテーブル */
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
                      // 現在のユーザーの行をハイライト
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
