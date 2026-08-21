import React from "react";
import { useTranslation } from "react-i18next";
import {
  Backdrop,
  CircularProgress,
  Typography,
  Box,
  LinearProgress,
} from "@mui/material";

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
  progress?: number; // 0-100の範囲で進行状況を表す（オプション）
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open,
  message,
  progress,
}) => {
  const { t } = useTranslation();

  // デフォルトのメッセージは翻訳キーから取得
  const loadingMessage = message || t("common.loading");
  return (
    <Backdrop
      sx={{
        color: "#fff",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        flexDirection: "column",
        gap: 2,
      }}
      open={open}
    >
      <CircularProgress color="inherit" size={60} />
      <Typography variant="h6" component="div" align="center">
        {loadingMessage}
      </Typography>

      {progress !== undefined && (
        <Box sx={{ width: "250px", mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            color="inherit"
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mt: 1,
            }}
          >
            <Typography variant="body2" color="inherit">
              {`${Math.round(progress)}%`}
            </Typography>
          </Box>
        </Box>
      )}
    </Backdrop>
  );
};

export default LoadingOverlay;
