import React, { useId } from "react";
import { Box, Typography } from "@mui/material";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import type { Scenario } from "../../types/index";
import { useTranslation } from "react-i18next";

interface PersonaPanelProps {
  npc: Scenario["npc"];
}

const isImageSource = (avatar?: string) =>
  Boolean(
    avatar &&
    (/^(https?:)?\/\//.test(avatar) ||
      avatar.startsWith("/") ||
      avatar.startsWith("data:image/")),
  );

/** 模拟客户身份与性格摘要。 */
const PersonaPanel: React.FC<PersonaPanelProps> = ({ npc }) => {
  const { t } = useTranslation();
  const headingId = `${useId().replaceAll(":", "")}-persona-panel-heading`;
  const personality = npc.personality ?? [];

  return (
    <Box component="section" role="region" aria-labelledby={headingId}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.25 }}>
        <PersonOutlineRoundedIcon
          sx={{ width: 17, height: 17, color: "text.secondary" }}
          aria-hidden="true"
        />
        <Typography
          component="h3"
          id={headingId}
          sx={{ fontSize: "0.75rem", fontWeight: 700 }}
        >
          {t("rightPanels.personaTitle")}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "12px",
            bgcolor: "#f1f4fa",
            color: "text.secondary",
            fontSize: "1.45rem",
          }}
          aria-hidden="true"
        >
          {isImageSource(npc.avatar) ? (
            <Box
              component="img"
              src={npc.avatar}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            npc.avatar || "👤"
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: "text.primary",
              fontSize: "0.875rem",
              fontWeight: 750,
              lineHeight: 1.4,
            }}
          >
            {npc.name}
          </Typography>
          <Typography
            sx={{
              mt: 0.2,
              color: "text.secondary",
              fontSize: "0.6875rem",
              lineHeight: 1.45,
            }}
          >
            {[npc.role, npc.company].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
      </Box>

      {personality.length > 0 ? (
        <Box
          sx={{ display: "flex", flexWrap: "wrap", gap: 0.65, mt: 1.25 }}
          aria-label={t("conversation.workspace.personaAria")}
        >
          {personality.map((trait) => (
            <Box
              component="span"
              key={trait}
              sx={{
                px: 0.8,
                py: 0.3,
                border: "1px solid",
                borderColor: "divider",
                color: "text.secondary",
                fontSize: "0.625rem",
                fontWeight: 550,
                lineHeight: 1.4,
              }}
            >
              {trait}
            </Box>
          ))}
        </Box>
      ) : null}

      {npc.description ? (
        <Typography
          sx={{
            mt: 1.25,
            color: "text.secondary",
            fontSize: "0.75rem",
            lineHeight: 1.65,
          }}
        >
          {npc.description}
        </Typography>
      ) : null}
    </Box>
  );
};

export default PersonaPanel;
