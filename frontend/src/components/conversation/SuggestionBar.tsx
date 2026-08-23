import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import { Lightbulb as LightbulbIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface SuggestionBarProps {
  /** AI 生成的应答候选列表 */
  suggestions: string[];
  /** 选择候选时的回调（传入所选文本） */
  onSelect: (text: string) => void;
  /** 无效状态（处理中、发言中等） */
  disabled: boolean;
}

/**
 * 建议应答按钮组件
 *
 * 根据 NPC 上一句发言由 AI 生成的应答候选，可通过点按/点击
 * 以可选择的按钮组显示。当候选为空或处于无效状态时，
 * 不显示任何内容。
 */
const SuggestionBar: React.FC<SuggestionBarProps> = ({
  suggestions,
  onSelect,
  disabled,
}) => {
  const { t } = useTranslation();

  // 无候选或处于无效状态时不显示任何内容
  if (disabled || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Box
      role="group"
      aria-label={t("conversation.suggestion.label")}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.5,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: 1,
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Box display="flex" alignItems="center" gap={0.5} sx={{ color: "text.secondary" }}>
        <LightbulbIcon fontSize="small" aria-hidden="true" />
        <Typography variant="caption">
          {t("conversation.suggestion.label")}
        </Typography>
      </Box>
      {suggestions.map((suggestion, index) => (
        <Chip
          key={`${index}-${suggestion}`}
          label={suggestion}
          variant="outlined"
          color="primary"
          clickable
          onClick={() => onSelect(suggestion)}
          data-testid={`suggestion-button-${index}`}
          aria-label={t("conversation.suggestion.select", { text: suggestion })}
          sx={{
            maxWidth: "100%",
            height: "auto",
            "& .MuiChip-label": {
              whiteSpace: "normal",
              py: 0.5,
            },
          }}
        />
      ))}
    </Box>
  );
};

export default SuggestionBar;
