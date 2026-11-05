import React from "react";
import {
  Card,
  CardContent,
  Typography,
  FormControlLabel,
  Switch,
  Box,
  Slider,
} from "@mui/material";
import {
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Person as PersonIcon,
  PersonOff as PersonOffIcon,


} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface SessionSettingsPanelProps {
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  // 化身显示开关（会话中的运行时切换）
  avatarVisible?: boolean;
  setAvatarVisible?: (visible: boolean) => void;
  avatarEnabled?: boolean;
  // 视频录像开关（仅商谈开始前可修改）
  videoRecordingEnabled?: boolean;
  setVideoRecordingEnabled?: (enabled: boolean) => void;
  // 录像设置是否可修改（商谈开始后锁定）
  recordingSettingLocked?: boolean;
}

/**
 * 会话设置面板组件
 * 整合音频设置与化身显示切换
 */
const SessionSettingsPanel: React.FC<SessionSettingsPanelProps> = ({
  audioEnabled,
  setAudioEnabled,
  audioVolume,
  setAudioVolume,
  speechRate,
  setSpeechRate,
  avatarVisible,
  setAvatarVisible,
  avatarEnabled,

}) => {
  // 由于 i18n 资源已静态打包并在 initImmediate:false 下同步初始化，
  // 首次渲染时 t() 即返回正确的翻译，无需回退机制，
  // 翻译文本以 ja.json / en.json 为单一事实来源（排除双重管理）。
  const { t } = useTranslation();

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>


        {/* 化身显示开关（仅在场景中化身启用时显示） */}
        {avatarEnabled && setAvatarVisible && (
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={avatarVisible ?? false}
                  onChange={(e) => setAvatarVisible(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box display="flex" alignItems="center">
                  {avatarVisible ? (
                    <PersonIcon fontSize="small" sx={{ mr: 1 }} />
                  ) : (
                    <PersonOffIcon fontSize="small" sx={{ mr: 1 }} />
                  )}
                  <Typography variant="body2">
                    {avatarVisible
                      ? t("conversation.settings.avatarOn")
                      : t("conversation.settings.avatarOff")}
                  </Typography>
                </Box>
              }
            />
          </Box>
        )}

        {/* 音频输出开关 */}
        <FormControlLabel
          control={
            <Switch
              checked={audioEnabled}
              onChange={(e) => setAudioEnabled(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Box display="flex" alignItems="center">
              {audioEnabled ? (
                <VolumeUpIcon fontSize="small" sx={{ mr: 1 }} />
              ) : (
                <VolumeOffIcon fontSize="small" sx={{ mr: 1 }} />
              )}
              <Typography variant="body2">
                {audioEnabled
                  ? t("conversation.audioSettings.outputOn")
                  : t("conversation.audioSettings.outputOff")}
              </Typography>
            </Box>
          }
        />

        {audioEnabled && (
          <>
            <Box mt={2}>
              <Typography id="audio-volume-slider" variant="body2" gutterBottom>
                {t("conversation.audioSettings.volume", {
                  volume: audioVolume,
                })}
              </Typography>
              <Slider
                value={audioVolume}
                onChange={(_, value) => setAudioVolume(value as number)}
                aria-labelledby="audio-volume-slider"
                step={10}
                marks
                min={0}
                max={100}
              />
            </Box>

            <Box mt={2}>
              <Typography id="speech-rate-slider" variant="body2" gutterBottom>
                {t("conversation.audioSettings.speechRate", {
                  rate: speechRate.toFixed(1),
                })}
              </Typography>
              <Slider
                value={speechRate}
                onChange={(_, value) => setSpeechRate(value as number)}
                aria-labelledby="speech-rate-slider"
                step={0.1}
                marks={[
                  { value: 0.5, label: "0.5x" },
                  { value: 1.0, label: "1.0x" },
                  { value: 1.5, label: "1.5x" },
                  { value: 2.0, label: "2.0x" },
                ]}
                min={0.5}
                max={2.0}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(1)}x`}
              />
            </Box>
          </>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {t("conversation.audioSettings.npcResponseNote")}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default SessionSettingsPanel;
