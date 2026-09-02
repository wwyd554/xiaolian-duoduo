import React, { useEffect, useMemo, useRef } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  GraphicEqRounded,
  SendRounded as SendIcon,
  SmartToyRounded,
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
  participantVisual?: React.ReactNode;
  isSpeaking?: boolean;
  isStarting?: boolean;
}

const isImageAvatar = (value: string | undefined): value is string =>
  Boolean(
    value &&
    (/^(https?:|data:|\/)/.test(value) ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(value)),
  );

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
  participantVisual,
  isSpeaking = false,
  isStarting = false,
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const canStart =
    !isStarting &&
    (!videoRecordingEnabled || isCameraInitialized || cameraError);

  const startButtonLabel = useMemo(() => {
    if (isStarting) return t("conversation.workspace.starting");
    if (!videoRecordingEnabled) return t("conversation.startButtonNoRecording");
    if (isCameraInitialized) return t("conversation.startButton");
    if (cameraError) return t("conversation.startButtonNoRecording");
    return t("conversation.cameraInitializing");
  }, [videoRecordingEnabled, isCameraInitialized, cameraError, isStarting, t]);

  const avatarSource = useMemo(() => {
    if (isImageAvatar(scenario.npc.avatar)) return scenario.npc.avatar;
    return scenario.npc.name === "林嘉诚"
      ? "/avatars/lin-jiacheng-cartoon-v2-340w.webp"
      : undefined;
  }, [scenario.npc.avatar, scenario.npc.name]);

  const latestNpcMessage = useMemo(
    () => [...messages].reverse().find((message) => message.sender !== "user"),
    [messages],
  );

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
        backgroundColor: sessionStarted ? "#f7f9fc" : "transparent",
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
              maxWidth: 620,
              p: { xs: 3, sm: 4.5 },
              textAlign: "center",
              borderRadius: 5,
              border: "1px solid #e2e7f0",
              background:
                "radial-gradient(circle at 88% 8%, rgba(43,89,209,.11), transparent 30%), #ffffff",
              boxShadow: "0 24px 70px rgba(30,36,48,.09)",
            }}
          >
            <Stack
              direction="row"
              justifyContent="center"
              alignItems="center"
              gap={0.75}
              sx={{ mb: 2.5 }}
            >
              <SmartToyRounded sx={{ color: "primary.main", fontSize: 18 }} />
              <Typography
                sx={{
                  color: "primary.main",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                }}
              >
                {t("conversation.workspace.preflightBadge")}
              </Typography>
            </Stack>

            <Avatar
              src={avatarSource}
              sx={{
                width: 96,
                height: 96,
                mx: "auto",
                mb: 2,
                fontSize: 42,
                bgcolor: "#edf2ff",
                color: "primary.main",
                border: "5px solid white",
                boxShadow:
                  "0 0 0 3px rgba(43,89,209,.14), 0 14px 32px rgba(43,89,209,.14)",
                "& img": { objectFit: "cover", objectPosition: "center 18%" },
              }}
            >
              {!avatarSource &&
                (scenario.npc.avatar || scenario.npc.name.charAt(0))}
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

            {!videoRecordingEnabled && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 2.25 }}
                role="status"
              >
                {t("conversation.recordingDisabledMessage")}
              </Typography>
            )}

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
              flexShrink: 0,
              display: "grid",
              gridTemplateColumns: {
                xs: "82px minmax(0,1fr)",
                sm: "170px minmax(0,1fr)",
              },
              alignItems: "center",
              gap: { xs: 1.5, sm: 3 },
              minHeight: { xs: 150, sm: 224 },
              pl: { xs: 1.5, sm: 3.5 },
              pr: videoRecordingEnabled
                ? { xs: 1.5, sm: 20 }
                : { xs: 1.5, sm: 3.5 },
              py: { xs: 1.5, sm: 2.5 },
              borderBottom: "1px solid #e8ecf2",
              background:
                "radial-gradient(circle at 12% 15%, rgba(43,89,209,.13), transparent 30%), radial-gradient(circle at 90% 10%, rgba(121,99,255,.08), transparent 32%), #fff",
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: { xs: 78, sm: 164 },
                height: { xs: 78, sm: 164 },
                mx: "auto",
                borderRadius: { xs: "50%", sm: 5 },
                overflow: "hidden",
                bgcolor: "#eaf0ff",
                border: "5px solid #fff",
                boxShadow: "0 12px 36px rgba(43,89,209,.16)",
              }}
            >
              {participantVisual || (
                <Avatar
                  src={avatarSource}
                  sx={{
                    width: "100%",
                    height: "100%",
                    bgcolor: "#eaf0ff",
                    color: "primary.main",
                    fontSize: { xs: 34, sm: 64 },
                    "& img": {
                      objectFit: "cover",
                      objectPosition: "center 14%",
                    },
                  }}
                >
                  {!avatarSource &&
                    (scenario.npc.avatar || scenario.npc.name.charAt(0))}
                </Avatar>
              )}
              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  right: 5,
                  bottom: 5,
                  width: { xs: 14, sm: 18 },
                  height: { xs: 14, sm: 18 },
                  borderRadius: "50%",
                  bgcolor: isSpeaking ? "primary.main" : "#2fae76",
                  border: "3px solid #fff",
                  boxShadow: isSpeaking
                    ? "0 0 0 5px rgba(43,89,209,.14)"
                    : "none",
                }}
              />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                alignItems="center"
                useFlexGap
                flexWrap="wrap"
                gap={0.75}
              >
                <Chip
                  size="small"
                  icon={isSpeaking ? <GraphicEqRounded /> : <SmartToyRounded />}
                  label={
                    isSpeaking
                      ? t("conversation.workspace.stageSpeaking")
                      : isProcessing
                        ? t("conversation.workspace.stageThinking")
                        : t("conversation.workspace.simulatedCustomer")
                  }
                  sx={{
                    height: 27,
                    bgcolor: isSpeaking ? "#eef2ff" : "#edf8f3",
                    color: isSpeaking ? "primary.main" : "#237c58",
                    fontWeight: 700,
                  }}
                />
                {scenario.npc.company && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: "none", sm: "block" } }}
                  >
                    {scenario.npc.company}
                  </Typography>
                )}
              </Stack>
              <Typography
                sx={{
                  mt: 0.75,
                  fontSize: { xs: 19, sm: 26 },
                  fontWeight: 780,
                  letterSpacing: "-.02em",
                }}
              >
                {scenario.npc.name}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ fontSize: { xs: 12, sm: 14 }, mt: 0.15 }}
              >
                {scenario.npc.role}
                {scenario.npc.company ? ` · ${scenario.npc.company}` : ""}
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  mt: { xs: 1, sm: 1.5 },
                  p: { xs: 1.15, sm: 1.5 },
                  maxWidth: 680,
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,.86)",
                  border: "1px solid rgba(215,222,235,.9)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: 12.5, sm: 15 },
                    lineHeight: 1.65,
                    color: latestNpcMessage ? "text.primary" : "text.secondary",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: { xs: 2, sm: 3 },
                    overflow: "hidden",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {latestNpcMessage?.content ||
                    t("conversation.workspace.connectedMessage")}
                </Typography>
              </Paper>
            </Box>
          </Box>

          <Box
            sx={{
              width: "100%",
              maxWidth: 900,
              mx: "auto",
              px: { xs: 1.25, sm: 2.5 },
              py: 2,
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
                    {isUser
                      ? t("conversation.workspace.me")
                      : !avatarSource
                        ? scenario.npc.avatar || scenario.npc.name.charAt(0)
                        : null}
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
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: "#edf2ff",
                    fontSize: 13,
                  }}
                >
                  {!avatarSource && scenario.npc.name.charAt(0)}
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
