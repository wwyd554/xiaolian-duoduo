import React, { useState } from "react";
import { Box, Button, Chip, Collapse, Paper, Typography } from "@mui/material";
import {
  LightbulbOutlined,
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface SuggestionBarProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled: boolean;
}

/** 将模型候选回复降级为按需查看的“应答思路”。 */
const SuggestionBar: React.FC<SuggestionBarProps> = ({
  suggestions,
  onSelect,
  disabled,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (disabled || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pt: 0.75 }}>
      <Paper
        elevation={0}
        role="group"
        aria-label={t("conversation.suggestion.label")}
        sx={{
          width: "100%",
          maxWidth: 900,
          mx: "auto",
          borderRadius: 3,
          border: "1px solid #e2e7f0",
          overflow: "hidden",
          bgcolor: "#fff",
        }}
      >
        <Button
          fullWidth
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          startIcon={<LightbulbOutlined fontSize="small" />}
          endIcon={
            expanded ? <KeyboardArrowUpRounded /> : <KeyboardArrowDownRounded />
          }
          sx={{
            minHeight: 40,
            px: 1.5,
            justifyContent: "flex-start",
            color: "#405170",
            fontSize: 13,
            fontWeight: 700,
            "& .MuiButton-endIcon": { ml: "auto" },
          }}
        >
          {t("conversation.workspace.replyIdeas")}
        </Button>

        <Collapse in={expanded}>
          <Box sx={{ px: 1.5, pb: 1.35, borderTop: "1px solid #edf0f5" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", py: 1 }}
            >
              {t("conversation.workspace.replyIdeasNote")}
            </Typography>
            <Box
              sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.25 }}
            >
              {suggestions.map((suggestion, index) => (
                <Chip
                  key={`${index}-${suggestion}`}
                  label={suggestion}
                  variant="outlined"
                  clickable
                  onClick={() => onSelect(suggestion)}
                  data-testid={`suggestion-button-${index}`}
                  aria-label={t("conversation.workspace.fillSuggestion", {
                    text: suggestion,
                  })}
                  sx={{
                    height: "auto",
                    minHeight: 34,
                    maxWidth: { xs: 260, md: 360 },
                    flexShrink: 0,
                    borderColor: "#dbe2ef",
                    bgcolor: "#f8faff",
                    color: "#33466b",
                    "& .MuiChip-label": {
                      whiteSpace: "normal",
                      py: 0.65,
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default SuggestionBar;
