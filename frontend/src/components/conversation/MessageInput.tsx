import React from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckRounded,
  GraphicEqRounded,
  MicRounded,
  SendRounded,
} from "@mui/icons-material";
import SpeechRecognitionFeedback from "../SpeechRecognitionFeedback";
import { useTranslation } from "react-i18next";

interface MessageInputProps {
  userInput: string;
  setUserInput: (input: string) => void;
  sendMessage: () => void;
  isProcessing: boolean;
  isListening: boolean;
  isConnecting?: boolean;
  speechRecognitionError: string | null;
  startSpeechRecognition: () => void;
  finishSpeechRecognition: () => void;
  switchToTextInput: () => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  sessionStarted: boolean;
  sessionEnded: boolean;
  continuousListening?: boolean;
}

/** 语音优先的会话输入 Dock。 */
const MessageInput: React.FC<MessageInputProps> = ({
  userInput,
  setUserInput,
  sendMessage,
  isProcessing,
  isListening,
  isConnecting = false,
  speechRecognitionError,
  startSpeechRecognition,
  finishSpeechRecognition,
  switchToTextInput,
  handleKeyDown,
  sessionStarted,
  sessionEnded,
  continuousListening = false,
}) => {
  const { t } = useTranslation();

  if (!sessionStarted || sessionEnded) {
    return null;
  }

  const micTooltip = isListening
    ? t("conversation.input.stopVoice")
    : userInput
      ? t("conversation.input.continueVoice")
      : t("conversation.input.startVoice");

  const statusLabel = isConnecting
    ? t("conversation.workspace.inputConnecting")
    : isListening
      ? t("conversation.workspace.inputListening")
      : isProcessing
        ? t("conversation.workspace.inputResponding")
        : t("conversation.workspace.yourTurn");

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: { xs: 1, sm: 2 }, pt: 0.75 }}>
      <SpeechRecognitionFeedback
        isListening={isListening}
        isProcessing={isProcessing}
        isConnecting={isConnecting}
        errorState={speechRecognitionError}
        onSwitchToTextInput={switchToTextInput}
      />

      <Paper
        elevation={0}
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: { xs: 0.75, sm: 1 },
          width: "100%",
          maxWidth: 900,
          minHeight: { xs: 64, sm: 72 },
          mx: "auto",
          px: { xs: 1, sm: 1.25 },
          py: 0.75,
          borderRadius: { xs: 3.5, sm: 4 },
          border: "1px solid",
          borderColor: isListening ? "rgba(43,89,209,.35)" : "#e3e7ee",
          backgroundColor: "rgba(255,255,255,.98)",
          boxShadow: isListening
            ? "0 12px 32px rgba(43,89,209,.13)"
            : "0 10px 28px rgba(24,39,75,.08)",
          transition: "border-color .2s ease, box-shadow .2s ease",
        }}
      >
        <Tooltip title={micTooltip} placement="top">
          <span>
            <IconButton
              onClick={startSpeechRecognition}
              disabled={isProcessing}
              color="primary"
              aria-label={micTooltip}
              sx={{
                position: "relative",
                width: { xs: 46, sm: 52 },
                height: { xs: 46, sm: 52 },
                flexShrink: 0,
                color: isListening ? "#fff" : "primary.main",
                bgcolor: isListening ? "primary.main" : "#eef2ff",
                border: "1px solid",
                borderColor: isListening ? "primary.main" : "#dce5ff",
                "&:hover": {
                  bgcolor: isListening ? "primary.dark" : "#e3eaff",
                },
              }}
            >
              {isListening ? <GraphicEqRounded /> : <MicRounded />}
              {(continuousListening || isListening) && isListening && (
                <Box
                  aria-hidden="true"
                  sx={{
                    position: "absolute",
                    inset: -5,
                    borderRadius: "50%",
                    border: "2px solid rgba(43,89,209,.38)",
                    animation: "voicePulse 1.5s ease-out infinite",
                    "@keyframes voicePulse": {
                      "0%": { transform: "scale(.9)", opacity: 0.8 },
                      "100%": { transform: "scale(1.22)", opacity: 0 },
                    },
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
                    },
                  }}
                />
              )}
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flex: 1, minWidth: 0, px: { xs: 0.25, sm: 0.75 } }}>
          <Typography
            variant="caption"
            sx={{
              display: { xs: "none", sm: "block" },
              mb: 0.1,
              color: isListening ? "primary.main" : "text.secondary",
              fontWeight: 700,
            }}
          >
            {statusLabel}
          </Typography>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            variant="standard"
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("conversation.input.placeholder")}
            disabled={isProcessing || isListening}
            inputProps={{ "aria-label": t("conversation.input.placeholder") }}
            InputProps={{ disableUnderline: true }}
            sx={{
              "& .MuiInputBase-root": {
                fontSize: { xs: 14, sm: 15 },
                lineHeight: 1.5,
              },
              "& textarea": { overflowWrap: "anywhere" },
            }}
          />
        </Box>

        {isListening ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckRounded />}
            onClick={finishSpeechRecognition}
            disabled={isProcessing}
            aria-label={t("conversation.input.doneSpeaking")}
            sx={{
              minWidth: { xs: 94, sm: 108 },
              height: 44,
              px: { xs: 1.5, sm: 2 },
              flexShrink: 0,
              borderRadius: 999,
              fontWeight: 800,
              whiteSpace: "nowrap",
              boxShadow: "0 8px 18px rgba(43,89,209,.24)",
            }}
          >
            {t("conversation.input.doneSpeaking")}
          </Button>
        ) : (
          <Tooltip title={t("conversation.input.send")} placement="top">
            <span>
              <IconButton
                onClick={() => sendMessage()}
                disabled={!userInput.trim() || isProcessing}
                aria-label={t("conversation.input.send")}
                sx={{
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  color: "#fff",
                  bgcolor: "primary.main",
                  "&:hover": { bgcolor: "primary.dark" },
                  "&.Mui-disabled": {
                    color: "#aeb6c5",
                    bgcolor: "#edf0f4",
                  },
                }}
              >
                <SendRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Paper>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: { xs: "none", md: "block" },
          textAlign: "center",
          mt: 0.65,
        }}
      >
        {t("conversation.workspace.inputHelp")}
      </Typography>
    </Box>
  );
};

export default MessageInput;
