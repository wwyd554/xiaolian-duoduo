import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AlertTitle,
  Snackbar,
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
} from "@mui/material";
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
} from "@mui/icons-material";

interface ErrorAlertProps {
  open: boolean;
  onClose: () => void;
  onRetry?: () => void;
  severity?: "error" | "warning" | "info" | "success";
  title?: string;
  message: string;
  fullScreen?: boolean;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({
  open,
  onClose,
  onRetry,
  severity = "error",
  title,
  message,
  fullScreen = false,
}) => {
  const { t } = useTranslation();

  // デフォルトのタイトル
  const defaultTitles = {
    error: t("common.error"),
    warning: t("common.warning"),
    info: t("common.info"),
    success: t("common.success"),
  };

  const finalTitle = title || defaultTitles[severity];

  // フルスクリーン表示の場合
  if (fullScreen) {
    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: open ? "flex" : "none",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
        }}
      >
        <Paper
          sx={{
            maxWidth: 500,
            width: "90%",
            p: 3,
            borderRadius: 2,
            boxShadow: 5,
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            sx={{
              mb: 2,
              color:
                severity === "error"
                  ? "error.main"
                  : severity === "warning"
                    ? "warning.main"
                    : severity === "success"
                      ? "success.main"
                      : "info.main",
            }}
          >
            <BugReportIcon sx={{ mr: 1 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {finalTitle}
            </Typography>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Typography variant="body1" paragraph>
            {message}
          </Typography>

          <Box display="flex" justifyContent="flex-end" gap={1}>
            {onRetry && (
              <Button
                startIcon={<RefreshIcon />}
                onClick={onRetry}
                variant="outlined"
                color={severity}
              >
                {t("common.retry")}
              </Button>
            )}

            <Button onClick={onClose} variant="contained" color={severity}>
              {t("common.close")}
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // 通常のSnackbar表示
  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity={severity}
        onClose={onClose}
        action={
          onRetry ? (
            <Button
              color="inherit"
              size="small"
              onClick={onRetry}
              startIcon={<RefreshIcon />}
            >
              {t("common.retry")}
            </Button>
          ) : undefined
        }
      >
        <AlertTitle>{finalTitle}</AlertTitle>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default ErrorAlert;
