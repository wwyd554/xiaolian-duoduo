import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  PlayArrow as PlayArrowIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  ContentCopy as ContentCopyIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { ScenarioInfo } from "../../types/api";
import { ApiService } from "../../services/ApiService";

interface ScenarioCardProps {
  scenario: ScenarioInfo;
  isOwner?: boolean;
  onDeleted?: (scenarioId: string) => void;
  onScenarioStart?: (scenarioId: string) => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  isOwner = false,
  onDeleted,
  onScenarioStart,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiService = ApiService.getInstance();

  // メニュー状態
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // メニュー操作ハンドラー
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // シナリオ開始
  const handleStartScenario = () => {
    if (onScenarioStart) {
      onScenarioStart(scenario.scenarioId);
    } else {
      navigate(`/session-loading/${scenario.scenarioId}`);
    }
  };

  // シナリオ編集
  const handleEditScenario = () => {
    handleMenuClose();
    navigate(`/scenarios/edit/${scenario.scenarioId}`);
  };

  // シナリオ複製
  const handleDuplicateScenario = async () => {
    handleMenuClose();
    // 複製機能は将来実装予定
    alert(t("scenarios.duplicate.notImplemented"));
  };

  // シナリオ共有
  const handleShareScenario = () => {
    handleMenuClose();
    // 共有機能は将来実装予定
    alert(t("scenarios.share.notImplemented"));
  };

  // シナリオ削除ダイアログ
  const handleDeleteDialogOpen = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setDeleteError(null);
  };

  // シナリオ削除処理
  const handleDeleteScenario = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiService.deleteScenario(scenario.scenarioId);
      handleDeleteDialogClose();

      // 親コンポーネントに削除を通知
      if (onDeleted) {
        onDeleted(scenario.scenarioId);
      }
    } catch (error) {
      console.error("シナリオ削除エラー:", error);
      setDeleteError(
        error instanceof Error
          ? error.message
          : t("scenarios.delete.error.unknown"),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // 難易度のラベル取得
  const getDifficultyLabel = (difficulty: string): string => {
    const labels: Record<string, string> = {
      easy: t("scenarios.difficulty.easy"),
      beginner: t("scenarios.difficulty.easy"),
      normal: t("scenarios.difficulty.normal"),
      medium: t("scenarios.difficulty.normal"),
      hard: t("scenarios.difficulty.hard"),
      advanced: t("scenarios.difficulty.hard"),
      expert: t("scenarios.difficulty.expert"),
    };
    return labels[difficulty] || difficulty;
  };

  // 難易度に応じたカラー
  const getDifficultyColor = (
    difficulty: string,
  ):
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning" => {
    const colors: Record<
      string,
      | "default"
      | "primary"
      | "secondary"
      | "error"
      | "info"
      | "success"
      | "warning"
    > = {
      easy: "success",
      beginner: "success",
      normal: "info",
      medium: "info",
      hard: "warning",
      advanced: "warning",
      expert: "error",
    };
    return colors[difficulty] || "default";
  };

  // カスタムシナリオかどうか
  const isCustomScenario = scenario.isCustom || false;

  // 公開設定のラベル
  const getVisibilityLabel = (): string => {
    if (!isOwner) return "";

    switch (scenario.visibility) {
      case "public":
        return t("scenarios.visibility.public");
      case "private":
        return t("scenarios.visibility.private");
      case "shared":
        return t("scenarios.visibility.shared");
      default:
        return "";
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* シナリオ情報 */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Typography variant="h6" component="h2" gutterBottom noWrap>
            {scenario.title}
          </Typography>

          {isOwner && (
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          )}
        </Box>

        {/* チップ表示 */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          {/* 難易度 */}
          <Chip
            size="small"
            label={getDifficultyLabel(scenario.difficulty)}
            color={getDifficultyColor(scenario.difficulty)}
            variant="outlined"
          />

          {/* カテゴリ/業界 */}
          <Chip
            size="small"
            label={
              scenario.category ||
              scenario.industry ||
              t("scenarios.category.general")
            }
            variant="outlined"
          />

          {/* カスタムシナリオ表示 */}
          {isCustomScenario && (
            <Chip
              size="small"
              label={t("scenarios.custom")}
              color="secondary"
              variant="outlined"
            />
          )}

          {/* 公開設定表示 */}
          {isOwner && scenario.visibility && (
            <Chip
              size="small"
              label={getVisibilityLabel()}
              variant="outlined"
            />
          )}
        </Box>

        {/* シナリオ説明 */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {scenario.description}
        </Typography>
      </CardContent>

      <CardActions>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
          }}
        >
          <Button
            size="small"
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleStartScenario}
          >
            {t("scenarios.start")}
          </Button>

          {scenario.pdfFiles && scenario.pdfFiles.length > 0 && (
            <Badge badgeContent={scenario.pdfFiles.length} color="primary">
              <PdfIcon color="action" />
            </Badge>
          )}
        </Box>
      </CardActions>

      {/* メニュー */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditScenario}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("scenarios.actions.edit")} />
        </MenuItem>
        <MenuItem onClick={handleDuplicateScenario}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("scenarios.actions.duplicate")} />
        </MenuItem>
        <MenuItem onClick={handleShareScenario}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("scenarios.actions.share")} />
        </MenuItem>
        <MenuItem onClick={handleDeleteDialogOpen}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary={t("scenarios.actions.delete")}
            sx={{ color: "error.main" }}
          />
        </MenuItem>
      </Menu>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteDialogClose}>
        <DialogTitle>{t("scenarios.delete.confirmTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("scenarios.delete.confirmMessage", { title: scenario.title })}
          </DialogContentText>

          {deleteError && (
            <Box sx={{ mt: 2 }}>
              <Typography color="error">{deleteError}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteDialogClose} disabled={isDeleting}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleDeleteScenario}
            color="error"
            disabled={isDeleting}
          >
            {isDeleting ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default ScenarioCard;
