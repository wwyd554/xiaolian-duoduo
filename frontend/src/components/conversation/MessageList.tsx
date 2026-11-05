import { customerAvatar } from "../../utils/customerAvatar";
import React, { useEffect, useMemo, useRef } from "react";
import { Avatar, Box, Button, Paper, Stack, Typography } from "@mui/material";
import {
  SendRounded as SendIcon,
  FaceRounded as FaceIcon,
} from "@mui/icons-material";
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
  videoRecordingEnabled?: boolean;
  slideImages?: SlideImageInfo[];
  onSlideClick?: (slideIndex: number) => void;
  /** 可选的 3D 形象；未传时使用场景头像或卡通降级图。 */
  isSpeaking?: boolean;
  isStarting?: boolean;
  startDisabled?: boolean;
}

const formatMessageTime = (timestamp: Date): string => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** 会前大厅与会中转录区。业务状态由 ConversationPage 继续管理。 */
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
  isStarting = false,
  startDisabled = false,
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const canStart =
    !isStarting && !startDisabled &&
    (!videoRecordingEnabled || isCameraInitialized || cameraError);

  const startButtonLabel = useMemo(() => {
    if (isStarting) return t("conversation.workspace.starting");
    if (!videoRecordingEnabled) return t("conversation.startButton");
    if (isCameraInitialized) return t("conversation.startButton");
    if (cameraError) return t("conversation.startButton");
    return t("conversation.cameraInitializing");
  }, [videoRecordingEnabled, isCameraInitialized, cameraError, isStarting, t]);

  const avatarSource = customerAvatar(scenario.npc.name, scenario.npc.avatar);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, isProcessing]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    shouldAutoScrollRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      120;
  };

  return (
    <Paper
      ref={scrollContainerRef}
      onScroll={handleScroll}
      elevation={0}
      role={sessionStarted ? "log" : "region"}
      aria-live={sessionStarted ? "polite" : undefined}
      aria-busy={sessionStarted ? isProcessing : undefined}
      data-testid={sessionStarted ? "conversation-transcript" : undefined}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "transparent",
        boxShadow: "none",
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!sessionStarted ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: { xs: 1, sm: 3 },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: "100%",
              maxWidth: 760,
              p: { xs: 3, sm: 4.5 },
              textAlign: "center",
              borderRadius: 5,
              border: "1px solid #e2e7f0",
              background:
                "radial-gradient(circle at 88% 8%, rgba(43,89,209,.11), transparent 30%), #ffffff",
              boxShadow: "0 24px 70px rgba(30,36,48,.09)",
            }}
          >
            <Avatar
              src={customerAvatar(
                scenario.npc.name,
                scenario.npc.avatar,
                "large",
              )}
              alt={scenario.npc.name}
              sx={{
                width: 72,
                height: 72,
                mx: "auto",
                mb: 2,
                fontSize: 30,
                bgcolor: "#edf2ff",
                color: "primary.main",
                border: "5px solid white",
                boxShadow:
                  "0 0 0 3px rgba(43,89,209,.14), 0 14px 32px rgba(43,89,209,.14)",
                "& img": { objectFit: "cover", objectPosition: "center 18%" },
              }}
            >
              <FaceIcon sx={{ fontSize: 42 }} />
            </Avatar>

            <Typography
              component="h1"
              variant="h4"
              sx={{ fontSize: { xs: 25, sm: 30 }, mb: 0.75 }}
            >
              {t("conversation.startQuestion")}
            </Typography>
            <Typography sx={{ fontWeight: 700, mb: 0.75 }}>
              {scenario.npc.name} · {scenario.npc.role}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 500, mx: "auto", lineHeight: 1.7 }}
            >
              {scenario.description}
            </Typography>

            <Box
              sx={{
                textAlign: "left",
                mt: 3,
                p: 2.5,
                bgcolor: "#f6f7fb",
                borderRadius: 3,
              }}
            >
              <Typography variant="subtitle2" color="primary.main" gutterBottom>
                你的任务 · 销售顾问
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.8 }}>
                与客户沟通需求，围绕下面的目标推进对话。结束后可查看基于本次沟通的反馈。
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                本次练习目标
              </Typography>
              {scenario.goals?.length ? (
                scenario.goals.map((goal, index) => (
                  <Box key={goal.id} sx={{ mt: 1.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {index + 1}. {goal.description}
                      {goal.isRequired ? " · 重点" : ""}
                    </Typography>
                    {goal.criteria?.length > 0 && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, lineHeight: 1.7 }}
                      >
                        达成标准：{goal.criteria.join("；")}
                      </Typography>
                    )}
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  此场景未设置具体目标，可先了解客户需求并确认下一步行动。
                </Typography>
              )}
            </Box>

            {videoRecordingEnabled && !isCameraInitialized && !cameraError && (
              <Typography
                variant="caption"
                color="warning.main"
                sx={{ display: "block", mt: 2.25 }}
                role="status"
                aria-live="polite"
              >
                {t("conversation.cameraInitializingMessage")}
              </Typography>
            )}

            {videoRecordingEnabled && cameraError && (
              <Typography
                variant="caption"
                color="error.main"
                sx={{ display: "block", mt: 2.25 }}
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
                mt: 3,
                minWidth: { xs: "100%", sm: 260 },
                borderRadius: 3,
              }}
            >
              {startButtonLabel}
            </Button>
          </Paper>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              width: "100%",
              maxWidth: 900,
              mx: "auto",
              px: { xs: 1.25, sm: 2.5 },
              py: { xs: 2, sm: 3 },
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.25 }}
            >
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#758095",
                  letterSpacing: ".08em",
                }}
              >
                {t("conversation.workspace.transcript")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("conversation.workspace.messageCount", {
                  count: messages.length,
                })}
              </Typography>
            </Stack>

            {messages.map((message) => {
              const isUser = message.sender === "user";
              return (
                <Box
                  key={message.id}
                  data-testid={isUser ? "message-user" : "message-npc"}
                  component="article"
                  aria-label={t("conversation.workspace.messageAria", {
                    speaker: isUser
                      ? t("conversation.workspace.you")
                      : scenario.npc.name,
                  })}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "36px minmax(0,1fr)",
                    gap: 1.25,
                    alignItems: "start",
                    mb: 1,
                    p: { xs: 1.15, sm: 1.4 },
                    borderRadius: 3,
                    bgcolor: isUser ? "#eef3ff" : "#fff",
                    border: "1px solid",
                    borderColor: isUser ? "#dce5ff" : "#e6eaf0",
                  }}
                >
                  <Avatar
                    src={!isUser ? avatarSource : undefined}
                    alt={!isUser ? scenario.npc.name : undefined}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: isUser ? "primary.main" : "#edf2ff",
                      color: isUser ? "#fff" : "primary.main",
                      fontSize: 15,
                      "& img": {
                        objectFit: "cover",
                        objectPosition: "center 15%",
                      },
                    }}
                  >
                    {isUser ? (
                      t("conversation.workspace.me")
                    ) : (
                      <FaceIcon sx={{ fontSize: 24 }} />
                    )}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={1}
                    >
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 750,
                          color: isUser ? "primary.main" : "#4f596b",
                        }}
                      >
                        {isUser
                          ? t("conversation.workspace.you")
                          : scenario.npc.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatMessageTime(message.timestamp)}
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{
                        mt: 0.4,
                        fontSize: { xs: 13.5, sm: 14.5 },
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {message.content}
                    </Typography>

                    {message.presentedSlides &&
                      message.presentedSlides.length > 0 &&
                      slideImages.length > 0 && (
                        <Box
                          sx={{
                            mt: 1,
                            display: "flex",
                            gap: 0.75,
                            flexWrap: "wrap",
                          }}
                        >
                          {message.presentedSlides.map((page) => {
                            const slide = slideImages.find(
                              (item) => item.pageNumber === page,
                            );
                            if (!slide) return null;
                            const index = slideImages.indexOf(slide);
                            return (
                              <Box
                                component="button"
                                type="button"
                                key={page}
                                onClick={() => onSlideClick?.(index)}
                                aria-label={t(
                                  "conversation.workspace.slideAria",
                                  { page },
                                )}
                                sx={{
                                  width: 64,
                                  height: 44,
                                  p: 0,
                                  borderRadius: 1,
                                  overflow: "hidden",
                                  cursor: "pointer",
                                  border: "1px solid #ccd5e5",
                                  bgcolor: "#f4f6fa",
                                  "&:hover, &:focus-visible": {
                                    outline: "2px solid #2b59d1",
                                    outlineOffset: 2,
                                  },
                                }}
                              >
                                {slide.thumbnailUrl ? (
                                  <Box
                                    component="img"
                                    src={slide.thumbnailUrl}
                                    alt={`Slide ${page}`}
                                    sx={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                ) : (
                                  <Box
                                    sx={{
                                      width: "100%",
                                      height: "100%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "text.secondary",
                                      fontSize: 11,
                                    }}
                                  >
                                    {page}
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                  </Box>
                </Box>
              );
            })}

            {isProcessing && (
              <Box
                role="status"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  mt: 0.5,
                  p: 1.25,
                  pr: 1.75,
                  borderRadius: 3,
                  bgcolor: "#fff",
                  border: "1px solid #e6eaf0",
                }}
              >
                <Avatar
                  src={avatarSource}
                  alt={scenario.npc.name}
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: "#edf2ff",
                    fontSize: 13,
                  }}
                >
                  <FaceIcon sx={{ fontSize: 22 }} />
                </Avatar>
                <Typography variant="body2" color="text.secondary">
                  {scenario.npc.name} {t("conversation.thinking")}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.35 }} aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <Box
                      key={index}
                      sx={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        animation: "thinkingDot 1s ease-in-out infinite",
                        animationDelay: `${index * 0.14}s`,
                        "@keyframes thinkingDot": {
                          "0%, 100%": {
                            opacity: 0.25,
                            transform: "translateY(0)",
                          },
                          "50%": { opacity: 1, transform: "translateY(-3px)" },
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                          animation: "none",
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {sessionEnded && (
              <Paper
                elevation={0}
                sx={{
                  mt: 2,
                  p: 2.5,
                  textAlign: "center",
                  borderRadius: 3,
                  border: "1px solid #dfe5ef",
                }}
              >
                <Typography variant="h6" gutterBottom>
                  {getSessionEndReason(currentMetrics, messages.length)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("conversation.redirectingToResults")}
                </Typography>
              </Paper>
            )}
          </Box>
          <div ref={messagesEndRef} />
        </>
      )}
    </Paper>
  );
};

export default MessageList;
