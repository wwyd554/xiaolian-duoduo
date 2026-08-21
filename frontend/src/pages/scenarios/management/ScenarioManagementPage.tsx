import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  IconButton,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Container,
  Chip,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload as DownloadIcon,
  FileUpload as UploadIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { ApiService } from "../../../services/ApiService";
import { AuthService } from "../../../services/AuthService";
import type { ScenarioInfo } from "../../../types/api";

const ScenarioManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiService = ApiService.getInstance();

  // ステート
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // シナリオ一覧を取得
  const fetchScenarios = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getScenarios();
      if (response && response.scenarios) {
        setScenarios(response.scenarios);
      }
      setError(null);
    } catch (err) {
      console.error("获取场景列表失败:", err);
      setError("获取场景列表失败");
    } finally {
      setLoading(false);
    }
  }, [apiService]);

  // 現在のユーザー情報を取得
  const fetchCurrentUser = useCallback(async () => {
    try {
      // AWS Cognitoから現在のユーザー情報を取得
      const { getCurrentUser } = await import("aws-amplify/auth");
      const user = await getCurrentUser();

      // ユーザーIDを設定（Cognitoのsub属性を使用）
      if (user && user.userId) {
        setCurrentUserId(user.userId);
      }

      // 管理者グループ所属を確認
      const authService = AuthService.getInstance();
      const adminStatus = await authService.isAdmin();
      setIsAdmin(adminStatus);
    } catch (err) {
      console.error("ユーザー情報の取得に失敗しました:", err);
    }
  }, []);

  // 初期ロード
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([fetchCurrentUser(), fetchScenarios()]);
    };
    initializeData();
  }, [fetchCurrentUser, fetchScenarios]);

  // シナリオの削除
  const handleDelete = async () => {
    if (!selectedScenarioId) return;

    try {
      setLoading(true);
      await apiService.deleteScenario(selectedScenarioId);
      setSuccessMessage(t("scenarios.management.deleteSuccess"));
      // 削除後に一覧を更新
      await fetchScenarios();
    } catch (err) {
      console.error("シナリオの削除に失敗しました:", err);
      setError("シナリオの削除に失敗しました");
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setSelectedScenarioId(null);
    }
  };

  // シナリオの編集
  const handleEdit = (scenarioId: string) => {
    navigate(`/scenarios/edit/${scenarioId}`);
  };

  // シナリオのエクスポート
  const handleExport = async (scenarioId: string) => {
    try {
      setExporting(scenarioId);

      // APIを使って単一シナリオをエクスポート
      const data = await apiService.exportScenario(scenarioId);

      // JSONデータに変換
      const jsonData = JSON.stringify(data, null, 2);

      // Blobを作成してダウンロード
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scenario_${scenarioId}_export_${new Date().toISOString().slice(0, 10)}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage(t("scenarios.management.exportSuccess"));
    } catch (err) {
      console.error("场景导出失败:", err);
      setError("场景导出失败");
    } finally {
      setExporting(null);
    }
  };

  // シナリオのインポート
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError(null);

      // ファイルを読み込み
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;

        try {
          // JSONをパース
          const jsonData = JSON.parse(content);

          // APIを使ってインポート
          await apiService.importScenarios(jsonData);

          setSuccessMessage(t("scenarios.management.importSuccess"));

          // インポート後に一覧を更新
          await fetchScenarios();
        } catch (parseErr) {
          console.error("JSONのパースに失敗しました:", parseErr);
          setError("無効なJSONファイルです");
        }

        setImporting(false);
      };

      reader.onerror = () => {
        setError("ファイルの読み込みに失敗しました");
        setImporting(false);
      };

      reader.readAsText(file);
    } catch (err) {
      console.error("场景导入失败:", err);
      setError("场景导入失败");
      setImporting(false);
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return t("scenarios.beginner");
      case "intermediate":
        return t("scenarios.intermediate");
      case "advanced":
        return t("scenarios.advanced");
      case "easy":
        return t("scenarios.beginner");
      case "normal":
      case "medium":
        return t("scenarios.intermediate");
      case "hard":
      case "expert":
        return t("scenarios.advanced");
      default:
        return difficulty;
    }
  };

  const getDifficultyColor = (
    difficulty: string,
  ): "success" | "warning" | "error" | "default" => {
    switch (difficulty) {
      case "beginner":
      case "easy":
        return "success";
      case "intermediate":
      case "normal":
      case "medium":
        return "warning";
      case "advanced":
      case "hard":
      case "expert":
        return "error";
      default:
        return "default";
    }
  };

  const getLanguageLabel = (language?: string) => {
    return language === "en" ? "English" : "日本語";
  };

  // シナリオの編集権限をチェック
  const canEditScenario = (scenario: ScenarioInfo): boolean => {
    // 現在のユーザーIDが取得できていない場合は権限なし
    if (!currentUserId) return false;

    // システム作成のデフォルトシナリオは管理者のみ編集可能
    if (scenario.createdBy === "system") return isAdmin;

    // 作成者と現在のユーザーが一致する場合のみ権限あり
    return scenario.createdBy === currentUserId;
  };

  // シナリオの削除権限をチェック
  const canDeleteScenario = (scenario: ScenarioInfo): boolean => {
    // 現在のユーザーIDが取得できていない場合は権限なし
    if (!currentUserId) return false;

    // システム作成のデフォルトシナリオは削除不可
    if (scenario.createdBy === "system") return false;

    // 作成者と現在のユーザーが一致する場合のみ権限あり
    return scenario.createdBy === currentUserId;
  };
  return (
    <Container maxWidth="lg">
      {/* ヘッダー */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {t("scenarios.management.title")}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {t("scenarios.management.subtitle")}
          </Typography>
        </Box>

        {/* インポートボタン */}
        <Box>
          <input
            accept=".json"
            id="scenario-import-file"
            type="file"
            style={{ display: "none" }}
            onChange={handleFileSelect}
            disabled={importing}
          />
          <label htmlFor="scenario-import-file">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              disabled={importing}
              sx={{ mr: 2 }}
            >
              {importing
                ? t("common.processing")
                : t("scenarios.management.importButton")}
            </Button>
          </label>
        </Box>
      </Box>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* データテーブル */}
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("scenarios.management.scenarioTitle")}</TableCell>
              <TableCell>{t("scenarios.management.difficulty")}</TableCell>
              <TableCell>{t("scenarios.management.category")}</TableCell>
              <TableCell>{t("scenarios.management.language")}</TableCell>
              <TableCell>作成者</TableCell>
              <TableCell align="right">
                {t("scenarios.management.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} sx={{ my: 3 }} />
                </TableCell>
              </TableRow>
            ) : scenarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {t("scenarios.noScenarios")}
                </TableCell>
              </TableRow>
            ) : (
              scenarios.map((scenario) => (
                <TableRow key={scenario.scenarioId}>
                  <TableCell>{scenario.title}</TableCell>
                  <TableCell>
                    <Chip
                      label={getDifficultyLabel(scenario.difficulty)}
                      color={getDifficultyColor(scenario.difficulty)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {scenario.category || ""}
                  </TableCell>
                  <TableCell>{getLanguageLabel(scenario.language)}</TableCell>
                  <TableCell>
                    {scenario.createdBy ? (
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Typography variant="body2">
                          {scenario.createdBy}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        システム
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      {/* 編集ボタン - 権限がある場合のみ表示 */}
                      {canEditScenario(scenario) && (
                        <Tooltip title={t("scenarios.management.edit")}>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(scenario.scenarioId)}
                            aria-label={`${t("scenarios.management.edit")} ${scenario.title}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {/* 削除ボタン - 権限がある場合のみ表示 */}
                      {canDeleteScenario(scenario) && (
                        <Tooltip title={t("scenarios.management.delete")}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedScenarioId(scenario.scenarioId);
                              setDeleteDialogOpen(true);
                            }}
                            aria-label={`${t("scenarios.management.delete")} ${scenario.title}`}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {/* エクスポートボタン - 全てのシナリオで表示 */}
                      <Tooltip title={t("scenarios.management.export")}>
                        <IconButton
                          size="small"
                          onClick={() => handleExport(scenario.scenarioId)}
                          aria-label={`${t("scenarios.management.export")} ${scenario.title}`}
                          disabled={exporting === scenario.scenarioId}
                          color="primary"
                        >
                          {exporting === scenario.scenarioId ? (
                            <CircularProgress size={16} />
                          ) : (
                            <DownloadIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{t("common.confirmation")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("scenarios.management.deleteConfirm")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            autoFocus
          >
            {t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 成功メッセージSnackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          sx={{ width: "100%" }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ScenarioManagementPage;
