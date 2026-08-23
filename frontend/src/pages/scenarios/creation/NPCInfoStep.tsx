import React, { useState, useMemo, useRef } from "react";
import {
  Box,
  TextField,
  Typography,
  Chip,
  Paper,
  Stack,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  Switch,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DeleteIcon from "@mui/icons-material/Delete";
import { NPCInfoStepProps } from "../../../types";
import { getVoicesForLanguage } from "../../../config/pollyVoices";

const NPCInfoStep: React.FC<NPCInfoStepProps> = ({
  formData,
  updateFormData,
  validationErrors = {},
  avatarFile,
  avatarFileName,
  onAvatarFileChange,
  voiceId,
  onVoiceIdChange,
  enableAvatar,
  onEnableAvatarChange,
}) => {
  const { t } = useTranslation();
  const [newPersonality, setNewPersonality] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // WR-015: 将 alert() 替换为 MUI Alert
  const [fileError, setFileError] = useState<string>("");

  // 根据语言获取语音模型列表
  const availableVoices = useMemo(() => {
    const lang = formData.language || "zh";
    return getVoicesForLanguage(lang);
  }, [formData.language]);

  // 性别显示用标签
  const genderLabel = (gender: string): string => {
    switch (gender) {
      case "male": return t("scenarios.create.voice.male");
      case "female": return t("scenarios.create.voice.female");
      case "male_child": return t("scenarios.create.voice.maleChild");
      case "female_child": return t("scenarios.create.voice.femaleChild");
      default: return "";
    }
  };

  // 文本框变更处理器
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateFormData({ [name]: value });
  };

  // 添加性格特征
  const handleAddPersonality = () => {
    if (
      newPersonality.trim() &&
      !formData.npc.personality.includes(newPersonality.trim())
    ) {
      updateFormData({
        personality: [...formData.npc.personality, newPersonality.trim()],
      });
      setNewPersonality("");
    }
  };

  // 删除性格特征
  const handleDeletePersonality = (personalityToDelete: string) => {
    updateFormData({
      personality: formData.npc.personality.filter(
        (personality) => personality !== personalityToDelete,
      ),
    });
  };

  // VRM 文件选择处理器
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // .vrm 扩展名检查
      if (!file.name.toLowerCase().endsWith(".vrm")) {
        setFileError(t("scenarios.create.avatar.invalidFormat"));
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      // 50MB 大小限制检查
      if (file.size > 50 * 1024 * 1024) {
        setFileError(t("scenarios.create.avatar.fileTooLarge"));
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setFileError("");
      onAvatarFileChange?.(file);
    }
    // 重置 input（允许重新选择同一文件）
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // VRM 文件删除处理器
  const handleFileRemove = () => {
    onAvatarFileChange?.(null);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t("scenarios.create.steps.npcInfo")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {t("scenarios.create.npcInfoDescription")}
      </Typography>

      <Box sx={{ mt: 3 }}>
        {/* NPC 的姓名 */}
        <TextField
          fullWidth
          required
          label={t("scenarios.fields.npcName")}
          name="name"
          value={formData.npc.name}
          onChange={handleChange}
          helperText={validationErrors.name ? t(validationErrors.name) : t("scenarios.create.npcNameHelp")}
          margin="normal"
          error={Boolean(validationErrors.name)}
        />

        {/* 役職 */}
        <TextField
          fullWidth
          required
          label={t("scenarios.fields.npcRole")}
          name="role"
          value={formData.npc.role}
          onChange={handleChange}
          helperText={validationErrors.role ? t(validationErrors.role) : t("scenarios.create.npcRoleHelp")}
          margin="normal"
          error={Boolean(validationErrors.role)}
        />

        {/* 会社名 */}
        <TextField
          fullWidth
          required
          label={t("scenarios.fields.npcCompany")}
          name="company"
          value={formData.npc.company}
          onChange={handleChange}
          helperText={validationErrors.company ? t(validationErrors.company) : t("scenarios.create.npcCompanyHelp")}
          margin="normal"
          error={Boolean(validationErrors.company)}
        />

        {/* 语音模型选择 */}
        {/* 将来扩展：如需添加语音预览播放功能，请
            在各 MenuItem 中添加 PlayArrowIcon 按钮，
            并使用 PollyService.synthesizeSpeech() 播放示例文本。
            为保持组件的可扩展性，建议将预览功能
            拆分为独立组件（如 VoicePreviewButton）。 */}
        <FormControl
          fullWidth
          required
          margin="normal"
          error={Boolean(validationErrors.voiceId)}
        >
          <InputLabel id="voice-select-label">
            {t("scenarios.create.voice.label")}
          </InputLabel>
          <Select
            labelId="voice-select-label"
            id="voice-select"
            value={voiceId || ""}
            label={t("scenarios.create.voice.label")}
            onChange={(e) => onVoiceIdChange?.(e.target.value)}
            data-testid="voice-select"
          >
            {availableVoices.map((voice) => (
              <MenuItem key={voice.voiceId} value={voice.voiceId}>
                {voice.displayName} ({genderLabel(voice.gender)})
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {validationErrors.voiceId
              ? t(validationErrors.voiceId)
              : t("scenarios.create.voice.help")}
          </FormHelperText>
        </FormControl>

        {/* 头像显示开/关切换 */}
        <FormControlLabel
          control={
            <Switch
              checked={enableAvatar ?? true}
              onChange={(e) => onEnableAvatarChange?.(e.target.checked)}
              aria-label={t("scenarios.create.avatar.enableToggle")}
              data-testid="enable-avatar-toggle"
            />
          }
          label={t("scenarios.create.avatar.enableToggle")}
          sx={{ mt: 3, mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 4, mb: 1 }}>
          {t("scenarios.create.avatar.enableToggleHelp")}
        </Typography>

        {/* VRM 头像上传（头像启用时显示） */}
        {enableAvatar && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
              {t("scenarios.create.avatar.label")}
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              {fileError && (
                <Alert severity="error" sx={{ mb: 1 }} onClose={() => setFileError("")}>
                  {fileError}
                </Alert>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".vrm"
                onChange={handleFileSelect}
                style={{ display: "none" }}
                id="vrm-file-input"
                aria-label={t("scenarios.create.avatar.selectFile")}
              />
              {avatarFile || avatarFileName ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InsertDriveFileIcon color="primary" />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {avatarFile?.name || avatarFileName}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleFileRemove}
                    aria-label={t("scenarios.create.avatar.remove")}
                  >
                    {t("common.delete")}
                  </Button>
                </Stack>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  fullWidth
                >
                  {t("scenarios.create.avatar.selectFile")}
                </Button>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                {t("scenarios.create.avatar.help")}
              </Typography>
            </Paper>
          </>
        )}

        {/* 性格特性 */}
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
          {t("scenarios.fields.npcPersonality")}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <TextField
            fullWidth
            label={t("scenarios.create.addPersonality")}
            value={newPersonality}
            onChange={(e) => setNewPersonality(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddPersonality();
              }
            }}
          />
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={handleAddPersonality}
            sx={{ ml: 1, height: "56px" }}
          >
            {t("common.add")}
          </Button>
        </Box>
        <Paper variant="outlined" sx={{ p: 2, mt: 1, minHeight: "100px" }}>
          {formData.npc.personality.length > 0 ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {formData.npc.personality.map((personality, index) => (
                <Chip
                  key={index}
                  label={personality}
                  onDelete={() => handleDeletePersonality(personality)}
                  sx={{ mt: 1 }}
                />
              ))}
            </Stack>
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ pt: 2 }}
            >
              {t("scenarios.create.noPersonalityAdded")}
            </Typography>
          )}
        </Paper>
        <Typography variant="caption" color="text.secondary">
          {t("scenarios.create.npcPersonalityHelp")}
        </Typography>

        {/* 詳細説明 */}
        <TextField
          fullWidth
          label={t("scenarios.fields.npcDescription")}
          name="description"
          value={formData.npc.description}
          onChange={handleChange}
          multiline
          rows={4}
          helperText={t("scenarios.create.npcDescriptionHelp")}
          margin="normal"
          sx={{ mt: 3 }}
        />

        {/* 初始消息 */}
        <TextField
          fullWidth
          label={t("scenarios.fields.npcInitialMessage")}
          name="initialMessage"
          value={formData.initialMessage || ""}
          onChange={handleChange}
          multiline
          rows={3}
          helperText={t("scenarios.create.npcInitialMessageHelp")}
          margin="normal"
          sx={{ mt: 2 }}
        />
      </Box>
    </Box>
  );
};

export default NPCInfoStep;
