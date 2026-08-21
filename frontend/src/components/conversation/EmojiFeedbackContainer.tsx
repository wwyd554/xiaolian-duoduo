import React, { useRef } from "react";
import { Box, Typography } from "@mui/material";
import { VolumeUp as VolumeUpIcon } from "@mui/icons-material";
import EmojiFeedback from "../EmojiFeedback";
import { EmotionState } from "../../types/index";
import { useTranslation } from "react-i18next";

interface EmojiFeedbackContainerProps {
  angerLevel: number;
  trustLevel: number;
  progressLevel: number;
  isSpeaking: boolean;
  onEmotionChange: (emotion: EmotionState) => void;
}

/**
 * EmojiFeedbackを表示するコンテナコンポーネント
 */
const EmojiFeedbackContainer: React.FC<EmojiFeedbackContainerProps> = ({
  angerLevel,
  trustLevel,
  progressLevel,
  isSpeaking,
  onEmotionChange,
}) => {
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // メトリクス値を使用

  return (
    <Box sx={{ position: "relative", height: "100%" }}>
      <Box
        ref={avatarContainerRef}
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
        aria-labelledby="emotion-feedback-label"
      >
        {/* アクセシビリティ対応のためのラベル */}
        <Typography
          id="emotion-feedback-label"
          sx={{ position: "absolute", left: "-9999px" }}
        >
          {t("conversation.emoji.emotionState")}
        </Typography>

        <Typography
          id="emotion-feedback-description"
          sx={{ position: "absolute", left: "-9999px" }}
        >
          {t("conversation.emoji.description")}
        </Typography>

        <EmojiFeedback
          angerLevel={angerLevel}
          trustLevel={trustLevel}
          progressLevel={progressLevel}
          size="medium" // サイズを中くらいに変更
          animationEnabled={true}
          ariaLabelledBy="emotion-feedback-label"
          ariaDescribedBy="emotion-feedback-description"
          onEmotionChange={onEmotionChange}
          // アクセシビリティ対応の設定
          focusable={true}
          tabIndex={0}
          announceStateChanges={true}
          highContrast={false} // ユーザー設定に応じて切り替える場合はここを変更
        />
      </Box>

      {/* 話している状態を表示するインジケーター */}
      {isSpeaking && (
        <Box
          sx={{
            position: "absolute",
            top: "5px",
            right: "5px",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            color: "white",
            padding: "2px 6px",
            borderRadius: "12px",
            fontSize: "0.7rem",
            display: "flex",
            alignItems: "center",
            gap: 0.3,
            zIndex: 10,
          }}
          role="status"
          aria-live="polite"
        >
          <VolumeUpIcon sx={{ fontSize: "0.9rem" }} />
        </Box>
      )}
    </Box>
  );
};

export default EmojiFeedbackContainer;
