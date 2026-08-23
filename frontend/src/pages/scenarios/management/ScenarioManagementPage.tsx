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

  // 状态
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

  // 获取场景列表
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

  // 获取当前用户信息
  const fetchCurrentUser = useCallback(async () => {
    try {
      // 从 AWS Cognito 获取当前用户信息
      const { getCurrentUser } = await import("aws-amplify/auth");
      const user = await getCurrentUser();

      // 设置用户 ID（使用 Cognito 的 sub 属性）
      if (user && user.userId) {
        setCurrentUserId(user.userId);
      }

      // 确认是否属于管理员组
      const authService = AuthService.getInstance();
      const adminStatus = await authService.isAdmin();
      setIsAdmin(adminStatus);
    } catch (err) {
      console.error("用户信息获取失败:", err);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([fetchCurrentUser(), fetchScenarios()]);
    };
    initializeData();
  }, [fetchCurrentUser, fetchScenarios]);

  // 删除场景
  const handleDelete = async () => {
    if (!selectedScenarioId) return;

    try {
      setLoading(true);
      await apiService.deleteScenario(selectedScenarioId);
      setSuccessMessage(t("scenarios.management.deleteSuccess"));
      // 删除后刷新列表
      await fetchScenarios();
    } catch (err) {
      console.error("场景删除失败:", err);
      setError("场景删除失败");
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setSelectedScenarioId(null);
    }
  };

  // 编辑场景
  const handleEdit = (scenarioId: string) => {
    navigate(`/scenarios/edit/${scenarioId}`);
  };

  // 导出场景
  const handleExport = async (scenarioId: string) => {
    try {
      setExporting(scenarioId);

      // 使用 API 导出单个场景
      const data = await apiService.exportScenario(scenarioId);

      // 转换为 JSON 数据
      const jsonData = JSON.stringify(data, null, 2);

      // 创建 Blob 并下载
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

  // 导入场景
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError(null);

      // 读取文件
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;

        try {
          // 解析 JSON
          const jsonData = JSON.parse(content);

          // 使用 API 导入
          await apiService.importScenarios(jsonData);

          setSuccessMessage(t("scenarios.management.importSuccess"));

          // 导入后刷新列表
          await fetchScenarios();
        } catch (parseErr) {
          console.error("JSON解析失败:", parseErr);
          setError("无效的 JSON 文件");
        }

        setImporting(false);
      };

      reader.onerror = () => {
        setError("文件读取失败");
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
    return language === "en" ? "English" : "日语";  };

  // 检查场景编辑权限
  const canEditScenario = (scenario: ScenarioInfo): boolean => {
    // 未获取到当前用户 ID 时无权限
    if (!currentUserId) return false;

    // 系统创建的默认场景仅管理员可编辑
    if (scenario.createdBy === "system") return isAdmin;

    // 仅当创建者与当前用户一致时有权限
    return scenario.createdBy === currentUserId;
  };

  // 检查场景删除权限
  const canDeleteScenario = (scenario: ScenarioInfo): boolean => {
    // 未获取到当前用户 ID 时无权限
    if (!currentUserId) return false;

    // 系统创建的默认场景不可删除
    if (scenario.createdBy === "system") return false;

    // 仅当创建者与当前用户一致时有权限
    return scenario.createdBy === currentUserId;
  };
  return (
    <Container maxWidth="lg">
      {/* 页头 */}
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

        {/* 导入按钮 */}
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

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 数据表 */}
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("scenarios.management.scenarioTitle")}</TableCell>
              <TableCell>{t("scenarios.management.difficulty")}</TableCell>
              <TableCell>{t("scenarios.management.category")}</TableCell>
              <TableCell>{t("scenarios.management.language")}</TableCell>
              <TableCell>创建者</TableCell>
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
                        系统
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      {/* 编辑按钮 - 仅有权限时显示 */}
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

                      {/* 删除按钮 - 仅有权限时显示 */}
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

                      {/* 导出按钮 - 所有场景均显示 */}
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

      {/* 删除确认对话框 */}
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

      {/* 成功消息 Snackbar */}
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
