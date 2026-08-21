import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Typography,
  Collapse,
} from "@mui/material";
import {
  Close as CloseIcon,
} from "@mui/icons-material";
import { ComplianceViolation } from "../../types/api";

interface ComplianceAlertProps {
  violation: ComplianceViolation;
  open: boolean;
  onClose: () => void;
  autoHideDuration?: number;
}

/**
 * コンプライアンス違反を通知するアラートコンポーネント
 * ヘッダー下にスライドインするバナー形式
 */
const ComplianceAlert: React.FC<ComplianceAlertProps> = ({
  violation,
  open,
  onClose,
  autoHideDuration = 8000,
}) => {
  const { t } = useTranslation();

  // 自動非表示タイマー
  React.useEffect(() => {
    if (open && autoHideDuration > 0) {
      const timer = setTimeout(onClose, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [open, autoHideDuration, onClose]);

  // 重大度に応じたスタイル
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "high":
        return {
          background: "#fef2f2",
          borderColor: "#fca5a5",
          icon: "🚨",
          label: t("compliance.severityHigh"),
        };
      case "medium":
        return {
          background: "#fffbeb",
          borderColor: "#fde68a",
          icon: "⚠️",
          label: t("compliance.severityMedium"),
        };
      default:
        return {
          background: "#eef2ff",
          borderColor: "#c7d2fe",
          icon: "ℹ️",
          label: t("compliance.severityLow"),
        };
    }
  };

  const styles = getSeverityStyles(violation.severity);

  return (
    <Collapse in={open}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          background: styles.background,
          borderBottom: `1px solid ${styles.borderColor}`,
          px: 2,
          py: 1.25,
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          zIndex: 50,
          animation: "slideDown 0.3s ease",
          "@keyframes slideDown": {
            from: { opacity: 0, maxHeight: 0, paddingTop: 0, paddingBottom: 0 },
            to: { opacity: 1, maxHeight: 60, paddingTop: 10, paddingBottom: 10 },
          },
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
          },
        }}
        role="alert"
      >
        {/* アイコン */}
        <Typography
          sx={{ fontSize: "1.25rem", flexShrink: 0 }}
          aria-hidden="true"
        >
          {styles.icon}
        </Typography>

        {/* メッセージ本文 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "text.secondary",
            }}
          >
            {styles.label}
          </Typography>
          <Typography
            sx={{ fontSize: "0.8125rem", lineHeight: 1.5, color: "text.primary" }}
          >
            {violation.messageKey
              ? String(t(violation.messageKey, violation.messageParams || {}))
              : violation.message}
          </Typography>
        </Box>

        {/* 閉じるボタン */}
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t("common.close")}
          sx={{
            width: 24,
            height: 24,
            flexShrink: 0,
            backgroundColor: "rgba(0,0,0,0.06)",
            "&:hover": { backgroundColor: "rgba(0,0,0,0.1)" },
          }}
        >
          <CloseIcon sx={{ fontSize: "0.75rem" }} />
        </IconButton>
      </Box>
    </Collapse>
  );
};

export default ComplianceAlert;
