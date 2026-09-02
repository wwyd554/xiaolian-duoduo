import React, { useId } from "react";
import { Box, Typography } from "@mui/material";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import type { Scenario } from "../../types/index";
import { useTranslation } from "react-i18next";

interface ScenarioPanelProps {
  scenario: Scenario;
}

const difficultyLabelKeys: Record<Scenario["difficulty"], string> = {
  easy: "conversation.workspace.difficultyEasy",
  normal: "conversation.workspace.difficultyNormal",
  hard: "conversation.workspace.difficultyHard",
  expert: "conversation.workspace.difficultyExpert",
};

/** 当前训练情境摘要。与客户资料组合使用，不包含独立卡片外壳。 */
const ScenarioPanel: React.FC<ScenarioPanelProps> = ({ scenario }) => {
  const { t } = useTranslation();
  const headingId = `${useId().replaceAll(":", "")}-scenario-panel-heading`;

  return (
    <Box component="section" role="region" aria-labelledby={headingId}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
        <FlagOutlinedIcon
          sx={{ width: 17, height: 17, color: "text.secondary" }}
          aria-hidden="true"
        />
        <Typography
          component="h3"
          id={headingId}
          sx={{ fontSize: "0.75rem", fontWeight: 700 }}
        >
          {t("rightPanels.scenarioTitle")}
        </Typography>
      </Box>

      <Typography
        sx={{
          mb: 0.75,
          color: "text.primary",
          fontSize: "0.8125rem",
          fontWeight: 700,
          lineHeight: 1.45,
        }}
      >
        {scenario.title}
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.75,
          mb: 1.1,
        }}
      >
        {scenario.industry ? (
          <Box
            component="span"
            sx={{
              px: 0.75,
              py: 0.25,
              bgcolor: "#f0f2f5",
              color: "text.secondary",
              fontSize: "0.625rem",
              fontWeight: 600,
            }}
          >
            {scenario.industry}
          </Box>
        ) : null}
        <Box
          component="span"
          sx={{
            px: 0.75,
            py: 0.25,
            bgcolor: "rgba(43, 89, 209, 0.07)",
            color: "primary.main",
            fontSize: "0.625rem",
            fontWeight: 650,
          }}
        >
          {t(difficultyLabelKeys[scenario.difficulty])}
        </Box>
      </Box>

      <Typography
        sx={{
          color: "text.secondary",
          fontSize: "0.75rem",
          lineHeight: 1.65,
          whiteSpace: "pre-line",
        }}
      >
        {scenario.description}
      </Typography>
    </Box>
  );
};

export default ScenarioPanel;
