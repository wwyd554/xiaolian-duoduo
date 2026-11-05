import { Avatar, Box, Card, CardActionArea, Typography } from "@mui/material";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import FaceRoundedIcon from "@mui/icons-material/FaceRounded";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { customerAvatar } from "../../utils/customerAvatar";
import type { ScenarioInfo } from "../../types/api";
import ScenarioCardMenu from "./ScenarioCardMenu";
import { designTokens as d } from "../../theme/designTokens";

type Props = {
  scenario: ScenarioInfo;
  canEdit: boolean;
  canDelete: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onDeleted: (id: string) => void;
};

export default function PracticeScenarioCard(props: Props) {
  const { scenario, favorite } = props;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const npc = scenario.npcInfo ?? scenario.npc;
  const difficulty =
    scenario.difficulty === "easy"
      ? "scenarios.beginner"
      : scenario.difficulty === "normal"
        ? "scenarios.intermediate"
        : "scenarios.advanced";
  const summary = scenario.goals?.[0]?.description || scenario.description;
  const duration = scenario.estimatedDuration
    ? t("scenarios.workspace.estimatedDuration", {
        minutes: scenario.estimatedDuration,
      })
    : t("scenarios.workspace.defaultDuration");

  return (
    <Card
      component="article"
      elevation={0}
      sx={{
        position: "relative",
        minWidth: 0,
        display: "flex",
        aspectRatio: "1.8",
        minHeight: 176,
        borderRadius: "20px",
        border: "1px solid",
        borderColor: favorite
          ? d.colors.primaryBorder
          : "rgba(255,255,255,.95)",
        bgcolor: "rgba(255,255,255,.58)",
        boxShadow: "none",
        transition: d.transition,
        "&:hover": {
          bgcolor: "rgba(255,255,255,.78)",
          borderColor: d.colors.primaryBorder,
          boxShadow: d.shadow.hover,
        },
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }}
    >
      <CardActionArea
        onClick={() =>
          navigate(`/conversation/${encodeURIComponent(scenario.scenarioId)}`)
        }
        aria-label={t("scenarios.workspace.startAria", {
          title: scenario.title,
        })}
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          textAlign: "left",
          p: 2.25,
          minWidth: 0,
          "& .MuiCardActionArea-focusHighlight": {
            bgcolor: d.colors.primarySoft,
          },
          "&.Mui-focusVisible": { outline: d.focus.outline, outlineOffset: -4 },
        }}
      >
        <Typography
          component="h2"
          noWrap
          title={scenario.title}
          sx={{
            pr: 4,
            fontSize: 17,
            lineHeight: 1.4,
            fontWeight: 600,
            letterSpacing: "-.015em",
            color: d.colors.ink,
          }}
        >
          {scenario.title}
        </Typography>
        <Typography
          noWrap
          title={summary}
          sx={{ mt: 0.5, fontSize: 13, lineHeight: 1.6, color: d.colors.muted }}
        >
          {summary}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 0.75,
            mt: 1.5,
          }}
        >
          {[
            scenario.category || t("scenarios.industry"),
            t(difficulty),
            duration,
          ].map((label, index) => (
            <Box
              component="span"
              key={index}
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: "7px",
                bgcolor: "rgba(255,255,255,.78)",
                color: d.colors.muted,
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </Box>
          ))}
          {favorite && (
            <StarRoundedIcon
              titleAccess={t("scenarios.filters.favoritesOnly")}
              sx={{ fontSize: 15, color: d.colors.warning }}
            />
          )}
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mt: "auto",
            pt: 1.5,
            borderTop: "1px solid rgba(255,255,255,.85)",
            minWidth: 0,
          }}
        >
          <Avatar
            src={customerAvatar(npc?.name, npc?.avatar)}
            slotProps={{ img: { loading: "lazy", decoding: "async" } }}
            alt={npc?.name || "AI"}
            sx={{
              width: 36,
              height: 36,
              bgcolor: "#E9EEFF",
              border: "1px solid rgba(255,255,255,.85)",
              color: d.colors.primaryHover,
              fontSize: 16,
            }}
          >
            <FaceRoundedIcon sx={{ fontSize: 24 }} />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              noWrap
              sx={{
                color: d.colors.ink,
                fontSize: 14,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              {npc?.name || t("scenarios.workspace.libraryTitle")}
            </Typography>
            <Typography
              noWrap
              sx={{ color: d.colors.muted, fontSize: 12, lineHeight: 1.5 }}
            >
              {npc
                ? [npc.role, npc.company].filter(Boolean).join(" · ")
                : t("scenarios.workspace.startButton")}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
      <Box sx={{ position: "absolute", right: 6, top: 6, zIndex: 1 }}>
        <ScenarioCardMenu {...props} />
      </Box>
    </Card>
  );
}
