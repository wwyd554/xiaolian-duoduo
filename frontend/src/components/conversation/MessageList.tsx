import React, { useRef, useEffect, useMemo } from "react";
import { Box, Typography, Paper, LinearProgress, Button } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";
import { Message, Metrics, Scenario } from "../../types/index";
import type { SlideImageInfo } from "../../types/api";
import { getSessionEndReason } from "../../utils/dialogueEngine";
import { DEFAULT_VIDEO_RECORDING_ENABLED } from "../../utils/videoRecordingSettings";
import { useTranslation } from "react-i18next";

interface MessageListProps {
  messages: Message[];
  isProcessing: boolean;
  sessionStarted: boolean;
  sessionEnded: boolean;
  currentMetrics: Metrics;
  scenario: Scenario;
  onStartConversation: () => void;
  isCameraInitialized?: boolean;
  cameraError?: boolean;
  /** 视频录像功能的启用/禁用 */
  videoRecordingEnabled?: boolean;
  /** 幻灯片图片列表（用于缩略图显示） */
  slideImages?: SlideImageInfo[];
  /** 点击幻灯片缩略图时的回调 */
  onSlideClick?: (slideIndex: number) => void;
}

/**
 * 消息列表组件
 */
const MessageList: React.FC<MessageListProps> = ({
  messages,
  isProcessing,
  sessionStarted,
  sessionEnded,
  currentMetrics,
  scenario,
  onStartConversation,
  isCameraInitialized = false,
  cameraError = false,
  videoRecordingEnabled = DEFAULT_VIDEO_RECORDING_ENABLED,
  slideImages = [],
  onSlideClick,
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 计算商谈开始按钮的可用性判定和标签
  // 录像关闭时始终可开始（不等待摄像头初始化）
  // 录像开启时仅在摄像头初始化完成或摄像头出错时才能开始
  const canStart = !videoRecordingEnabled || isCameraInitialized || cameraError;

  // 按钮标签的决定（aria-label 与显示文本共用）
  const startButtonLabel = useMemo(() => {
    if (!videoRecordingEnabled) {
      return t("conversation.startButtonNoRecording");
    }
    if (isCameraInitialized) {
      return t("conversation.startButton");
    }
    if (cameraError) {
      return t("conversation.startButtonNoRecording");
    }
    return t("conversation.cameraInitializing");
  }, [videoRecordingEnabled, isCameraInitialized, cameraError, t]);

  // 消息自动滚动（防止父元素滚动）
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      // 用 requestAnimationFrame 在渲染后滚动
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages, isProcessing]);

  return (
    <Paper
      ref={scrollContainerRef}
      sx={{
        flex: 1,
        minHeight: 0,
        p: 2,
        overflow: "auto",
        backgroundColor: sessionStarted ? "#fafafa" : "transparent",
        border: sessionStarted ? "1px solid #e0e0e0" : "none",
        boxShadow: sessionStarted ? undefined : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!sessionStarted ? (
        <Box textAlign="center" py={4} sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Typography variant="h6" gutterBottom>
            {t("conversation.startQuestion")}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {scenario.description}
          </Typography>

          {/* 录像关闭时的消息 */}
          {!videoRecordingEnabled && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 2 }}
              role="status"
            >
              {t("conversation.recordingDisabledMessage")}
            </Typography>
          )}

          {/* 录像开启且摄像头初始化中的消息 */}
          {videoRecordingEnabled && !isCameraInitialized && !cameraError && (
            <Typography
              variant="caption"
              color="warning.main"
              sx={{ display: "block", mb: 2 }}
              role="status"
              aria-live="polite"
            >
              {t("conversation.cameraInitializingMessage")}
            </Typography>
          )}

          {/* 录像开启且摄像头访问失败的消息 */}
          {videoRecordingEnabled && cameraError && (
            <Typography
              variant="caption"
              color="error.main"
              sx={{ display: "block", mb: 2 }}
              role="alert"
            >
              {t("conversation.cameraAccessFailed")}
            </Typography>
          )}

          <Button
            variant="contained"
            size="large"
            onClick={onStartConversation}
            startIcon={<SendIcon />}
            disabled={!canStart}
            data-testid="start-conversation-button"
            aria-label={startButtonLabel}
            sx={{
              opacity: canStart ? 1 : 0.6,
            }}
          >
            {startButtonLabel}
          </Button>
        </Box>
      ) : (
        <>
          {messages.map((message) => (
            <Box key={message.id} mb={2}>
              <Box
                display="flex"
                justifyContent={
                  message.sender === "user" ? "flex-end" : "flex-start"
                }
              >
                <Paper
                  sx={{
                    p: 2,
                    maxWidth: "70%",
                    backgroundColor:
                      message.sender === "user" ? "primary.main" : "white",
                    color: message.sender === "user" ? "white" : "text.primary",
                  }}
                >
                  <Typography variant="body1">{message.content}</Typography>
                  {/* 幻灯片附件缩略图 */}
                  {message.presentedSlides && message.presentedSlides.length > 0 && slideImages.length > 0 && (
                    <Box sx={{ mt: 0.5, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {message.presentedSlides.map((page) => {
                        const slide = slideImages.find(s => s.pageNumber === page);
                        if (!slide) return null;
                        const idx = slideImages.indexOf(slide);
                        return (
                          <Box
                            key={page}
                            onClick={(e) => { e.stopPropagation(); onSlideClick?.(idx); }}
                            sx={{
                              width: 48, height: 34, borderRadius: 0.5, overflow: "hidden",
                              cursor: "pointer", border: 1, borderColor: "rgba(255,255,255,0.4)",
                              "&:hover": { opacity: 0.8 },
                            }}
                          >
                            {slide.thumbnailUrl ? (
                              <Box component="img" src={slide.thumbnailUrl} alt={`Slide ${page}`}
                                sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <Box sx={{ width: "100%", height: "100%", bgcolor: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: "0.5rem" }}>
                                {page}
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      opacity: 0.7,
                      display: "block",
                      mt: 0.5,
                    }}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          ))}

          {isProcessing && (
            <Box display="flex" justifyContent="flex-start" mb={2}>
              <Paper sx={{ p: 2, backgroundColor: "white" }}>
                <Typography variant="body2" color="text.secondary">
                  {scenario.npc.name} {t("conversation.thinking")}
                </Typography>
                <LinearProgress sx={{ mt: 1, width: 150 }} />
              </Paper>
            </Box>
          )}

          {sessionEnded && (
            <Box textAlign="center" py={3}>
              <Typography variant="h6" gutterBottom>
                {getSessionEndReason(currentMetrics, messages.length)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("conversation.redirectingToResults")}
              </Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </>
      )}
    </Paper>
  );
};

export default MessageList;
