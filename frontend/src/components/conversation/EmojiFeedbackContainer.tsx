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
 * 显示 EmojiFeedback 的容器组件
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

  // 使用指标值

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
        {/* 用于无障碍支持的标签 */}
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
          size="medium" // 将尺寸改为中等
          animationEnabled={true}
          ariaLabelledBy="emotion-feedback-label"
          ariaDescribedBy="emotion-feedback-description"
          onEmotionChange={onEmotionChange}
          // 无障碍支持的设置
          focusable={true}
          tabIndex={0}
          announceStateChanges={true}
          highContrast={false} // 如需按用户设置切换请修改此处
        />
      </Box>

      {/* 显示正在说话状态的指示器 */}
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
