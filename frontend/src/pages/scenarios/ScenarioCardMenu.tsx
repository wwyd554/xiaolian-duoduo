import { useId, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiService } from "../../services/ApiService";
import type { ScenarioInfo } from "../../types/api";

type Props = {
  scenario: ScenarioInfo;
  canEdit: boolean;
  canDelete: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onDeleted: (scenarioId: string) => void;
};

export default function ScenarioCardMenu({
  scenario,
  canEdit,
  canDelete,
  favorite,
  onToggleFavorite,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteLock = useRef(false);

  const closeConfirmation = () => {
    if (deleteLock.current) return;
    setConfirmOpen(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!canDelete || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setError(null);
    try {
      await ApiService.getInstance().deleteScenario(scenario.scenarioId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("scenarios.cardMenu.deleteFailed"),
      );
      return;
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
    setConfirmOpen(false);
    onDeleted(scenario.scenarioId);
  };

  return (
    <>
      <IconButton
        id={`${id}-trigger`}
        size="small"
        aria-label={t("scenarios.cardMenu.actions", { title: scenario.title })}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? `${id}-menu` : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          width: 44,
          height: 44,
          flexShrink: 0,
          color: "text.secondary",
          borderRadius: "9px",
          bgcolor: anchor ? "rgba(40,51,77,.08)" : "transparent",
          "&:hover": { bgcolor: "rgba(40,51,77,.08)" },
        }}
      >
        <MoreHorizRoundedIcon sx={{ fontSize: 22 }} />
      </IconButton>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 184,
              maxWidth: 260,
              borderRadius: "16px",
              border: "1px solid rgba(32,39,57,.06)",
              boxShadow: "0 12px 40px rgba(38,49,83,.13)",
              "& .MuiMenuItem-root": {
                minHeight: 44,
                borderRadius: "9px",
                fontSize: 14,
              },
              "& .MuiListItemText-primary": { fontSize: 14 },
              "& .MuiListItemIcon-root": { minWidth: 30 },
            },
          },
          list: { "aria-labelledby": `${id}-trigger`, sx: { p: 0.75 } },
        }}
      >
        <MenuItem
          disabled={!canEdit}
          onClick={() => {
            if (!canEdit) return;
            setAnchor(null);
            navigate(
              `/scenarios/edit/${encodeURIComponent(scenario.scenarioId)}`,
            );
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText>{t("scenarios.cardMenu.edit")}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!canDelete}
          onClick={() => {
            if (!canDelete) return;
            setAnchor(null);
            setError(null);
            setConfirmOpen(true);
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText>{t("scenarios.cardMenu.delete")}</ListItemText>
        </MenuItem>
        {!canDelete && (
          <Box component="li" role="none" sx={{ px: 1.5, pb: 1 }}>
            <Typography
              sx={{ fontSize: 11, lineHeight: 1.5, color: "text.secondary" }}
            >
              {t(
                scenario.createdBy === "system"
                  ? "scenarios.cardMenu.systemHint"
                  : "scenarios.cardMenu.ownerHint",
              )}
            </Typography>
          </Box>
        )}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            onToggleFavorite();
            setAnchor(null);
          }}
        >
          <ListItemIcon>
            {favorite ? (
              <StarRoundedIcon sx={{ fontSize: 18, color: "#b78325" }} />
            ) : (
              <StarBorderRoundedIcon sx={{ fontSize: 18 }} />
            )}
          </ListItemIcon>
          <ListItemText>
            {t(
              favorite
                ? "scenarios.workspace.removeFavoriteAria"
                : "scenarios.workspace.addFavoriteAria",
            )}
          </ListItemText>
        </MenuItem>
      </Menu>
      <Dialog
        open={confirmOpen}
        onClose={closeConfirmation}
        maxWidth="xs"
        fullWidth
        aria-labelledby={`${id}-delete-title`}
        aria-describedby={`${id}-delete-description`}
        slotProps={{ paper: { sx: { borderRadius: "20px", p: 1 } } }}
      >
        <DialogTitle
          id={`${id}-delete-title`}
          sx={{ fontSize: 21, fontWeight: 700 }}
        >
          {t("scenarios.cardMenu.confirmTitle")}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1, fontWeight: 600, overflowWrap: "anywhere" }}>
            {scenario.title}
          </Typography>
          <DialogContentText
            id={`${id}-delete-description`}
            sx={{ fontSize: 14 }}
          >
            {t("scenarios.cardMenu.confirmDescription")}
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: "12px" }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            color="inherit"
            disabled={deleting}
            onClick={closeConfirmation}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={handleDelete}
            startIcon={
              deleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
            sx={{ borderRadius: "10px", boxShadow: "none" }}
          >
            {t(
              deleting ? "common.deleting" : "scenarios.cardMenu.confirmDelete",
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
