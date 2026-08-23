import React from "react";
import { Box, Typography, CircularProgress, Alert, Fade } from "@mui/material";
import { Mic, ErrorOutline, TextFields, WifiTethering } from "@mui/icons-material";
import { visuallyHidden } from "@mui/utils";
import {
  getFocusStyles,
  getAccessibleAnimation,
} from "../utils/accessibilityUtils";
import { useTranslation } from "react-i18next";

interface SpeechRecognitionFeedbackProps {
  isListening: boolean;
  isProcessing: boolean;
  isConnecting?: boolean;
  errorState: string | null;
  onSwitchToTextInput?: () => void;
}

/**
 * 以可视化方式显示语音识别状态的组件
 *
 * 以可视化方式显示语音识别状态（聆听中、处理中、错误），
 * 出错时提供回退到文本输入的选项。
 *
 * 无障碍支持：
 * - 为屏幕阅读器兼容性添加 ARIA 属性
 * - 支持键盘导航
 * - 考虑色觉异常的配色对比度
 * - 状态变化的通知
 */
const SpeechRecognitionFeedback: React.FC<SpeechRecognitionFeedbackProps> = ({
  isListening,
  isProcessing,
  isConnecting = false,
  errorState,
  onSwitchToTextInput,
}) => {
  const { t } = useTranslation();

  // 错误状态的情况
  if (errorState) {
    return (
      <Fade in={true}>
        <Box sx={{ mb: 2 }}>
          <Alert
            severity="warning"
            icon={<ErrorOutline />}
            action={
              onSwitchToTextInput && (
                <Box
                  component="button"
                  onClick={onSwitchToTextInput}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "primary.main",
                    fontSize: "0.875rem",
                    p: 0.5,
                    "&:hover": {
                      textDecoration: "underline",
                    },
                    "&:focus-visible": getFocusStyles(),
                  }}
                  aria-label={t("speech.switchToTextInput")}
                >
                  <TextFields
                    sx={{ mr: 0.5 }}
                    fontSize="small"
                    aria-hidden="true"
                  />
                  {t("speech.switchToText")}
                </Box>
              )
            }
            role="alert"
            aria-live="assertive"
          >
            <Typography variant="body2">
              {errorState === "permission" &&
                t("speech.error.permissionDenied")}
              {errorState === "no-speech" && t("speech.error.noSpeech")}
              {errorState === "network" && t("speech.error.network")}
              {errorState === "not-supported" && t("speech.error.notSupported")}
              {errorState === "unknown" && t("speech.error.unknown")}
            </Typography>
          </Alert>
        </Box>
      </Fade>
    );
  }

  // 连接中的情况
  if (isConnecting) {
    return (
      <Fade in={true}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            borderRadius: 1,
            bgcolor: "rgba(156, 39, 176, 0.08)", // 连接中为紫色系
            mb: 2,
          }}
          role="status"
          aria-live="polite"
        >
          <Box
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WifiTethering
              color="secondary"
              sx={{
                ...getAccessibleAnimation("pulse", 2000),
                "@keyframes pulse": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.4 },
                  "100%": { opacity: 1 },
                },
              }}
              aria-hidden="true"
            />
            <Box
              sx={{
                position: "absolute",
                width: "200%",
                height: "200%",
                borderRadius: "50%",
                border: "2px solid",
                borderColor: "secondary.main",
                opacity: 0.3,
                ...getAccessibleAnimation("ripple", 2000),
                "@keyframes ripple": {
                  "0%": { transform: "scale(0.5)", opacity: 0.3 },
                  "100%": { transform: "scale(1.2)", opacity: 0 },
                },
              }}
              aria-hidden="true"
            />
          </Box>
          <Typography
            variant="body2"
            color="secondary"
          >
            {t("speech.connecting")}
          </Typography>
          <Typography sx={visuallyHidden}>
            {t("speech.a11y.connecting")}
          </Typography>
        </Box>
      </Fade>
    );
  }

  // 聆听中或处理中的情况
  if (isListening || isProcessing) {
    return (
      <Fade in={true}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 1.5,
            borderRadius: 1,
            bgcolor: isListening ? "rgba(25, 118, 210, 0.08)" : "transparent",
            mb: 2,
          }}
          role="status"
          aria-live="polite"
        >
          {isListening ? (
            <Box
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mic
                color="primary"
                sx={{
                  ...getAccessibleAnimation("pulse", 1500),
                  "@keyframes pulse": {
                    "0%": { opacity: 1 },
                    "50%": { opacity: 0.6 },
                    "100%": { opacity: 1 },
                  },
                }}
                aria-hidden="true"
              />
              <Box
                sx={{
                  position: "absolute",
                  width: "200%",
                  height: "200%",
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor: "primary.main",
                  opacity: 0.3,
                  ...getAccessibleAnimation("ripple", 1500),
                  "@keyframes ripple": {
                    "0%": { transform: "scale(0.5)", opacity: 0.3 },
                    "100%": { transform: "scale(1.2)", opacity: 0 },
                  },
                }}
                aria-hidden="true"
              />
            </Box>
          ) : (
            <CircularProgress size={24} thickness={5} aria-hidden="true" />
          )}
          <Typography
            variant="body2"
            color={isListening ? "primary" : "text.secondary"}
          >
            {isListening ? t("speech.listening") : t("speech.processing")}
          </Typography>
          <Typography sx={visuallyHidden}>
            {isListening
              ? t("speech.a11y.listening")
              : t("speech.a11y.processing")}
          </Typography>
        </Box>
      </Fade>
    );
  }

  // 非激活状态（不显示）
  return null;
};

export default SpeechRecognitionFeedback;
