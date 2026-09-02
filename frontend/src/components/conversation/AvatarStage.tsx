import React from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { VRMAvatarContainer } from "../avatar";
import type { EmotionState } from "../../types/index";
import type { GestureType } from "../../types/avatar";

interface AvatarStageProps {
  // 化身相关
  avatarId?: string;
  avatarS3Key?: string;
  angerLevel: number;
  trustLevel: number;
  progressLevel: number;
  isSpeaking: boolean;
  directEmotion?: EmotionState;
  gesture?: GestureType;
  onEmotionChange?: (emotion: EmotionState) => void;
}

/**
 * 化身舞台组件
 * 将 VRMAvatarContainer 以居中放大显示包裹，
 * 显示 NPC 名称标签和发言中的声波指示器
 */
const AvatarStage: React.FC<AvatarStageProps> = ({
  avatarId,
  avatarS3Key,
  angerLevel,
  trustLevel,
  progressLevel,
  isSpeaking,
  directEmotion,
  gesture,
  onEmotionChange,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
      role="region"
      aria-label={t("avatarStage.label")}
    >
      {/* VRM 化身 */}
      <Box
        sx={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <VRMAvatarContainer
          avatarId={avatarId}
          avatarS3Key={avatarS3Key}
          angerLevel={angerLevel}
          trustLevel={trustLevel}
          progressLevel={progressLevel}
          isSpeaking={isSpeaking}
          directEmotion={directEmotion}
          gesture={gesture}
          onEmotionChange={onEmotionChange}
        />
      </Box>

      {/* 发言中的声波指示器 */}
      {isSpeaking && (
        <Box
          sx={{
            position: "absolute",
            bottom: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "3px",
            height: 24,
          }}
          role="status"
          aria-label={t("avatarStage.speakingIndicator")}
        >
          {[8, 16, 24, 16, 8].map((h, i) => (
            <Box
              key={i}
              sx={{
                width: 4,
                height: h,
                backgroundColor: "#4f46e5",
                borderRadius: 2,
                animation: `wave 0.6s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
                "@keyframes wave": {
                  "0%, 100%": { transform: "scaleY(0.4)" },
                  "50%": { transform: "scaleY(1)" },
                },
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default React.memo(AvatarStage);
