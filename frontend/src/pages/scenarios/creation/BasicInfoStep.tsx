import React from "react";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  FormHelperText,
  SelectChangeEvent,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { ScenarioBasicInfo } from "../../../types";

interface BasicInfoStepProps {
  formData: ScenarioBasicInfo;
  updateFormData: (data: Partial<ScenarioBasicInfo>) => void;
  validationErrors?: Partial<Record<keyof ScenarioBasicInfo, string | null>>;
  isEditMode?: boolean;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  formData,
  updateFormData,
  validationErrors,
  isEditMode = false,
}) => {
  const { t } = useTranslation();

  // 入力フィールドの変更ハンドラー
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    if (name) {
      updateFormData({ [name]: value } as Partial<ScenarioBasicInfo>);
    }
  };

  // セレクトフィールドの変更ハンドラー
  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    if (name) {
      updateFormData({ [name]: value });
    }
  };

  // 難易度オプション
  const difficultyOptions = [
    { value: "easy", label: t("scenarios.difficulty.easy") },
    { value: "normal", label: t("scenarios.difficulty.normal") },
    { value: "hard", label: t("scenarios.difficulty.hard") },
    { value: "expert", label: t("scenarios.difficulty.expert") },
  ];

  // カテゴリオプション
  const categoryOptions = [
    { value: "general", label: t("scenarios.category.general") },
    { value: "it", label: t("scenarios.category.it") },
    { value: "finance", label: t("scenarios.category.finance") },
    { value: "medical", label: t("scenarios.category.medical") },
    { value: "retail", label: t("scenarios.category.retail") },
    { value: "manufacturing", label: t("scenarios.category.manufacturing") },
  ];

  // 语言选项
  const languageOptions = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
  ];

  return (
    <Box role="region" aria-labelledby="basic-info-title">
      <Typography variant="h6" gutterBottom id="basic-info-title">
        {t("scenarios.create.steps.basicInfo")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        {t("scenarios.create.basicInfoDescription")}
      </Typography>

      <Box sx={{ mt: 3 }} component="form" noValidate>
        {/* シナリオID */}
        <TextField
          fullWidth
          label={t("scenarios.fields.scenarioId")}
          name="scenarioId"
          value={formData.scenarioId || ""}
          onChange={handleChange}
          helperText={
            isEditMode
              ? t("scenarios.edit.scenarioIdReadOnly")
              : validationErrors?.scenarioId
                ? t(validationErrors.scenarioId)
                : t("scenarios.create.scenarioIdHelp")
          }
          margin="normal"
          error={Boolean(validationErrors?.scenarioId)}
          disabled={isEditMode}
          slotProps={{
            input: {
              "aria-describedby": "scenario-id-helper-text",
              readOnly: isEditMode,
            },
            formHelperText: {
              id: "scenario-id-helper-text",
            },
          }}
          data-testid="scenario-id-input"
        />

        {/* タイトル */}
        <TextField
          fullWidth
          required
          label={t("scenarios.fields.title")}
          name="title"
          value={formData.title || ""}
          onChange={handleChange}
          helperText={
            validationErrors?.title
              ? t(validationErrors.title)
              : t("scenarios.create.titleHelp")
          }
          margin="normal"
          error={Boolean(validationErrors?.title)}
          slotProps={{
            input: {
              "aria-describedby": "title-helper-text",
            },
            formHelperText: {
              id: "title-helper-text",
            },
          }}
          data-testid="title-input"
        />

        {/* 説明 */}
        <TextField
          fullWidth
          required
          label={t("scenarios.fields.description")}
          name="description"
          value={formData.description || ""}
          onChange={handleChange}
          multiline
          rows={4}
          helperText={
            validationErrors?.description
              ? t(validationErrors.description)
              : t("scenarios.create.descriptionHelp")
          }
          margin="normal"
          error={Boolean(validationErrors?.description)}
          slotProps={{
            input: {
              "aria-describedby": "description-helper-text",
            },
            formHelperText: {
              id: "description-helper-text",
            },
          }}
          data-testid="description-input"
        />

        {/* 難易度 */}
        <FormControl fullWidth margin="normal" required>
          <InputLabel id="difficulty-label">
            {t("scenarios.fields.difficulty")}
          </InputLabel>
          <Select
            name="difficulty"
            value={formData.difficulty || ""}
            label={t("scenarios.fields.difficulty")}
            onChange={handleSelectChange}
            labelId="difficulty-label"
            slotProps={{
              input: {
                "aria-describedby": "difficulty-helper-text",
              },
            }}
            data-testid="difficulty-select"
          >
            {difficultyOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText id="difficulty-helper-text">
            {t("scenarios.create.difficultyHelp")}
          </FormHelperText>
        </FormControl>

        {/* カテゴリ */}
        <FormControl
          fullWidth
          margin="normal"
          required
          error={Boolean(validationErrors?.category)}
        >
          <InputLabel id="category-label">
            {t("scenarios.fields.category")}
          </InputLabel>
          <Select
            name="category"
            value={formData.category || ""}
            label={t("scenarios.fields.category")}
            onChange={handleSelectChange}
            labelId="category-label"
            slotProps={{
              input: {
                "aria-describedby": "category-helper-text",
              },
            }}
            data-testid="category-select"
          >
            {categoryOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText id="category-helper-text">
            {validationErrors?.category
              ? t(validationErrors.category)
              : t("scenarios.create.categoryHelp")}
          </FormHelperText>
        </FormControl>

        {/* 言語 */}
        <FormControl
          fullWidth
          margin="normal"
          required
          error={Boolean(validationErrors?.language)}
        >
          <InputLabel id="language-label">
            {t("scenarios.fields.language")}
          </InputLabel>
          <Select
            name="language"
            value={formData.language || ""}
            label={t("scenarios.fields.language")}
            onChange={handleSelectChange}
            labelId="language-label"
            slotProps={{
              input: {
                "aria-describedby": "language-helper-text",
              },
            }}
            data-testid="language-select"
          >
            {languageOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText id="language-helper-text">
            {validationErrors?.language
              ? t(validationErrors.language)
              : t("scenarios.create.languageHelp")}
          </FormHelperText>
        </FormControl>

        {/* 最大ターン数 */}
        <FormControl
          fullWidth
          margin="normal"
          error={Boolean(validationErrors?.maxTurns)}
        >
          {/* 最大会話ターン数の入力フィールド（1-100の範囲） */}
          <TextField
            name="maxTurns"
            label={t("scenarios.fields.maxTurns")}
            type="number"
            value={formData.maxTurns || ""}
            onChange={(e) => {
              const value = e.target.value
                ? parseInt(e.target.value, 10)
                : undefined;
              updateFormData({ maxTurns: value });
            }}
            inputProps={{ min: 1, max: 100 }}
            helperText={
              validationErrors?.maxTurns
                ? t(validationErrors.maxTurns)
                : t("scenarios.create.maxTurnsHelp")
            }
            data-testid="maxTurns-input"
          />
        </FormControl>
      </Box>
    </Box>
  );
};

export default BasicInfoStep;
