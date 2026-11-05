import React, { useCallback, useState } from "react";
import {
  Box,
  ButtonBase,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CallEndRounded from "@mui/icons-material/CallEndRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import PsychologyRounded from "@mui/icons-material/PsychologyRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import SentimentSatisfiedAltRounded from "@mui/icons-material/SentimentSatisfiedAltRounded";
import TipsAndUpdatesRounded from "@mui/icons-material/TipsAndUpdatesRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import { useTranslation } from "react-i18next";

type FlowStageId = "practice" | "score" | "coach" | "repeat";

interface FlowStage {
  id: FlowStageId;
  labelKey: string;
  eyebrowKey: string;
}

const FLOW_STAGES: readonly FlowStage[] = [
  {
    id: "practice",
    labelKey: "home.showcase.tabs.practice.label",
    eyebrowKey: "home.showcase.tabs.practice.eyebrow",
  },
  {
    id: "score",
    labelKey: "home.showcase.tabs.score.label",
    eyebrowKey: "home.showcase.tabs.score.eyebrow",
  },
  {
    id: "coach",
    labelKey: "home.showcase.tabs.coach.label",
    eyebrowKey: "home.showcase.tabs.coach.eyebrow",
  },
  {
    id: "repeat",
    labelKey: "home.showcase.tabs.repeat.label",
    eyebrowKey: "home.showcase.tabs.repeat.eyebrow",
  },
];

const WorkspaceWindowBar: React.FC = () => {
  return (
    <Box
      sx={{
        height: { xs: 42, sm: 48 },
        px: { xs: 1.5, sm: 2 },
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        bgcolor: "rgba(251,250,247,.96)",
        borderBottom: "1px solid rgba(30,36,48,.09)",
      }}
    >
      <Stack direction="row" gap={0.55} aria-hidden="true">
        {["#ff716a", "#f1c75b", "#68c981"].map((color) => (
          <Box
            key={color}
            sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }}
          />
        ))}
      </Stack>
      <Box sx={{ flex: 1 }} />
      <MoreHorizRounded
        sx={{ fontSize: 18, color: "text.secondary" }}
        aria-hidden="true"
      />
    </Box>
  );
};

const MetricBar: React.FC<{
  label: string;
  value: number;
  color: string;
  helper: string;
}> = ({ label, value, color, helper }) => {
  const { t } = useTranslation();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,.72)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 1.25,
        }}
      >
        <Typography fontWeight={700}>{label}</Typography>
        <Typography sx={{ color, fontWeight: 800, fontSize: 22 }}>
          {value}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value}
        aria-label={t("home.showcase.metricAria", { label, value })}
        sx={{
          height: 7,
          borderRadius: 999,
          bgcolor: alpha(color, 0.12),
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 999 },
        }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1.25 }}
      >
        {helper}
      </Typography>
    </Paper>
  );
};

const PracticeStage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ width: "100%", maxWidth: 570, mx: "auto" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "#25a66a",
              boxShadow: "0 0 0 5px rgba(37,166,106,.12)",
            }}
          />
          <Typography
            sx={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}
          >
            {t("home.showcase.practice.simulatedCustomer")}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {t("home.showcase.practice.listening")}
        </Typography>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems="center"
        gap={{ xs: 2, sm: 3.5 }}
      >
        <Box
          sx={{
            position: "relative",
            width: { xs: 150, sm: 170 },
            height: { xs: 150, sm: 170 },
            borderRadius: "50%",
            flexShrink: 0,
            overflow: "hidden",
            bgcolor: "#eaf0ff",
            border: "5px solid white",
            boxShadow:
              "0 0 0 4px rgba(37,99,235,.20), 0 18px 46px rgba(37,99,235,.16)",
          }}
        >
          <Box
            component="img"
            src="/avatars/lin-jiacheng-cartoon-v2-340w.webp"
            alt={t("home.showcase.practice.avatarAlt")}
            sx={{
              position: "absolute",
              width: "111%",
              height: "111%",
              maxWidth: "none",
              objectFit: "contain",
              objectPosition: "center bottom",
              left: "50%",
              bottom: "-8%",
              transform: "translateX(-50%)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              right: 7,
              bottom: 12,
              width: 18,
              height: 18,
              borderRadius: "50%",
              bgcolor: "#FF5A5F",
              border: "4px solid white",
            }}
          />
        </Box>

        <Box
          sx={{ flex: 1, minWidth: 0, textAlign: { xs: "center", sm: "left" } }}
        >
          <Typography
            component="h3"
            sx={{
              fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
              fontSize: { xs: 25, sm: 30 },
              lineHeight: 1.2,
              fontWeight: 760,
            }}
          >
            {t("home.showcase.practice.customerName")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 15 }}>
            {t("home.showcase.practice.customerRoleCompany")}
          </Typography>

          <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            justifyContent={{ xs: "center", sm: "flex-start" }}
            gap={0.75}
            sx={{ mt: 1.75 }}
          >
            <Chip
              size="small"
              variant="outlined"
              label={t("home.showcase.practice.discoveryTag")}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t("home.showcase.practice.languageTag")}
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<SentimentSatisfiedAltRounded />}
              label={t("home.showcase.practice.personalityTag")}
            />
          </Stack>
        </Box>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          position: "relative",
          mt: 2.25,
          px: { xs: 2, sm: 2.5 },
          py: 1.75,
          borderRadius: 3,
          bgcolor: "rgba(37,99,235,.065)",
          border: "1px solid rgba(37,99,235,.11)",
          "&::before": {
            content: '""',
            position: "absolute",
            top: -7,
            left: { xs: "calc(50% - 7px)", sm: 44 },
            width: 14,
            height: 14,
            bgcolor: "#edf2ff",
            borderLeft: "1px solid rgba(37,99,235,.11)",
            borderTop: "1px solid rgba(37,99,235,.11)",
            transform: "rotate(45deg)",
          },
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: 14, sm: 15 },
            lineHeight: 1.65,
            fontWeight: 600,
          }}
        >
          {t("home.showcase.practice.customerQuote")}
        </Typography>
      </Paper>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 2, pt: 1.75, borderTop: "1px solid", borderColor: "divider" }}
      >
        <Stack direction="row" alignItems="baseline" gap={1}>
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: 20,
              color: "text.primary",
            }}
          >
            08:42
          </Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
            {t("home.showcase.practice.inProgress")}
          </Typography>
        </Stack>
        <Stack
          aria-hidden="true"
          direction="row"
          alignItems="center"
          gap={0.8}
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1,
            borderRadius: "14px",
            color: "#fff",
            bgcolor: "#FF5A5F",
          }}
        >
          <CallEndRounded sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
            {t("home.showcase.practice.endPractice")}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
};

const ScoreStage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ width: "100%", maxWidth: 760, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems="center"
        gap={{ xs: 3, md: 6 }}
      >
        <Box
          sx={{
            width: 174,
            height: 174,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "conic-gradient(#2563EB 0 86%, #e8edf6 86% 100%)",
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 142,
              height: 142,
              borderRadius: "50%",
              bgcolor: "white",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 44, lineHeight: 1, fontWeight: 800 }}>
                86
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("home.showcase.score.overallPerformance")}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ flex: 1, textAlign: { xs: "center", md: "left" } }}>
          <Typography variant="overline" color="primary.main">
            {t("home.showcase.score.eyebrow")}
          </Typography>
          <Typography
            variant="h4"
            component="h3"
            sx={{ mt: 0.5, mb: 1.5, fontWeight: 750 }}
          >
            {t("home.showcase.score.title")}
          </Typography>
          <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {t("home.showcase.score.body")}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: 1.5,
          mt: 4,
        }}
      >
        <MetricBar
          label={t("home.showcase.score.metrics.trust.label")}
          value={78}
          color="#2563EB"
          helper={t("home.showcase.score.metrics.trust.helper")}
        />
        <MetricBar
          label={t("home.showcase.score.metrics.anger.label")}
          value={16}
          color="#FF5A5F"
          helper={t("home.showcase.score.metrics.anger.helper")}
        />
        <MetricBar
          label={t("home.showcase.score.metrics.progress.label")}
          value={64}
          color="#25a66a"
          helper={t("home.showcase.score.metrics.progress.helper")}
        />
      </Box>
    </Box>
  );
};

const CoachStage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ width: "100%", maxWidth: 760, mx: "auto" }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 3 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: "#fff2e8",
            color: "#e7682a",
          }}
        >
          <TipsAndUpdatesRounded />
        </Box>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t("home.showcase.coach.eyebrow")}
          </Typography>
          <Typography variant="h4" component="h3" sx={{ fontWeight: 750 }}>
            {t("home.showcase.coach.title")}
          </Typography>
        </Box>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: 3,
          bgcolor: "#eef3ff",
          borderLeft: "4px solid #2563EB",
        }}
      >
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          {t("home.showcase.coach.recommendationLabel")}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 18, sm: 22 },
            lineHeight: 1.55,
            fontWeight: 650,
          }}
        >
          {t("home.showcase.coach.recommendedQuestion")}
        </Typography>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.5,
          mt: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack
            direction="row"
            gap={1.25}
            alignItems="center"
            sx={{ mb: 1.25 }}
          >
            <CheckCircleRounded sx={{ color: "#25a66a" }} />
            <Typography fontWeight={750}>
              {t("home.showcase.coach.strengthTitle")}
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>
            {t("home.showcase.coach.strengthBody")}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack
            direction="row"
            gap={1.25}
            alignItems="center"
            sx={{ mb: 1.25 }}
          >
            <PsychologyRounded sx={{ color: "#FF5A5F" }} />
            <Typography fontWeight={750}>
              {t("home.showcase.coach.improvementTitle")}
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>
            {t("home.showcase.coach.improvementBody")}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

const RepeatStage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ width: "100%", maxWidth: 760, mx: "auto", textAlign: "center" }}>
      <Box
        sx={{
          width: 96,
          height: 96,
          mx: "auto",
          borderRadius: "28px",
          display: "grid",
          placeItems: "center",
          color: "white",
          background: "linear-gradient(135deg, #2563EB, #6a79ff 58%, #FF5A5F)",
          boxShadow: "0 20px 48px rgba(37,99,235,.28)",
        }}
      >
        <ReplayRounded sx={{ fontSize: 48 }} />
      </Box>
      <Typography
        variant="overline"
        color="primary.main"
        sx={{ display: "block", mt: 3 }}
      >
        {t("home.showcase.repeat.eyebrow")}
      </Typography>
      <Typography variant="h3" component="h3" sx={{ mt: 0.5, fontWeight: 760 }}>
        {t("home.showcase.repeat.title")}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ maxWidth: 590, mx: "auto", mt: 2, lineHeight: 1.7, fontSize: 17 }}
      >
        {t("home.showcase.repeat.body")}
      </Typography>
      <Stack
        direction="row"
        useFlexGap
        flexWrap="wrap"
        justifyContent="center"
        gap={1}
        sx={{ mt: 3 }}
      >
        <Chip
          icon={<TrendingUpRounded />}
          label={t("home.showcase.repeat.difficultyTag")}
        />
        <Chip
          icon={<InsightsRounded />}
          label={t("home.showcase.repeat.goalTag")}
        />
        <Chip label={t("home.showcase.repeat.durationTag")} />
      </Stack>
      <Stack
        aria-hidden="true"
        direction="row"
        alignItems="center"
        justifyContent="center"
        gap={0.8}
        sx={{
          width: "fit-content",
          minWidth: 190,
          mx: "auto",
          mt: 4,
          px: 2.5,
          py: 1.35,
          borderRadius: 999,
          bgcolor: "#222321",
          color: "#fff",
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
          {t("home.showcase.repeat.cta")}
        </Typography>
        <ArrowForwardRounded sx={{ fontSize: 18 }} />
      </Stack>
    </Box>
  );
};

const STAGE_CONTENT: Record<FlowStageId, React.ReactNode> = {
  practice: <PracticeStage />,
  score: <ScoreStage />,
  coach: <CoachStage />,
  repeat: <RepeatStage />,
};

const ExperienceFlowShowcase: React.FC = () => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const activeStage = FLOW_STAGES[activeIndex];

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % FLOW_STAGES.length;
      }
      if (event.key === "ArrowLeft") {
        nextIndex =
          (currentIndex - 1 + FLOW_STAGES.length) % FLOW_STAGES.length;
      }
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = FLOW_STAGES.length - 1;

      if (nextIndex !== currentIndex) {
        event.preventDefault();
        setActiveIndex(nextIndex);
        window.requestAnimationFrame(() => {
          document
            .getElementById(`flow-tab-${FLOW_STAGES[nextIndex].id}`)
            ?.focus();
        });
      }
    },
    [],
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 840, mx: "auto" }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>产品流程示例 · 以下为演示内容</Typography>
      <Box
        role="tablist"
        aria-label={t("home.showcase.flowAria")}
        sx={{
          display: "flex",
          alignItems: "center",
          width: "fit-content",
          maxWidth: "100%",
          mx: { xs: "auto", md: 0 },
          mb: 1.75,
          p: 0.45,
          overflowX: "auto",
          borderRadius: 999,
          bgcolor: "rgba(255,255,255,.52)",
          border: "1px solid rgba(30,36,48,.09)",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {FLOW_STAGES.map((stage, index) => {
          const isActive = index === activeIndex;
          return (
            <ButtonBase
              key={stage.id}
              id={`flow-tab-${stage.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={isActive ? `flow-panel-${stage.id}` : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              sx={{
                minWidth: { xs: 74, sm: 96 },
                px: { xs: 1.1, sm: 1.5 },
                py: 0.72,
                borderRadius: 999,
                color: isActive ? "#fff" : "#686b72",
                bgcolor: isActive ? "#222321" : "transparent",
                transition: reduceMotion
                  ? "none"
                  : "background-color .2s ease, color .2s ease",
                "&:hover": {
                  bgcolor: isActive ? "#222321" : "rgba(31,32,30,.06)",
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: 11, sm: 12 },
                  fontWeight: 750,
                  whiteSpace: "nowrap",
                }}
              >
                {t(stage.labelKey)}
              </Typography>
              <Typography
                sx={{
                  display: { xs: "none", lg: "block" },
                  ml: 0.6,
                  fontSize: 8.5,
                  letterSpacing: ".05em",
                  opacity: 0.62,
                }}
              >
                {t(stage.eyebrowKey)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      <Box
        sx={{
          position: "relative",
          p: { xs: 1, sm: 1.3 },
          borderRadius: { xs: "26px", sm: "34px" },
          background:
            "linear-gradient(145deg, rgba(177,177,255,.95) 0%, rgba(211,195,255,.92) 42%, rgba(170,214,255,.92) 100%)",
          border: "1px solid rgba(90,91,150,.2)",
          boxShadow:
            "0 32px 70px rgba(69,72,119,.22), inset 0 1px 0 rgba(255,255,255,.58)",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: "8% 9% auto auto",
            width: "38%",
            height: "44%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,.48), rgba(255,255,255,0) 70%)",
            filter: "blur(18px)",
            pointerEvents: "none",
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            zIndex: 1,
            overflow: "hidden",
            borderRadius: { xs: "19px", sm: "24px" },
            border: "1px solid rgba(30,36,48,.12)",
            bgcolor: "#f7f7f5",
            boxShadow: "0 20px 46px rgba(53,54,82,.2)",
          }}
        >
          <WorkspaceWindowBar />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              minHeight: { xs: 520, sm: 465, lg: 478 },
            }}
          >
            <Box
              key={activeStage.id}
              id={`flow-panel-${activeStage.id}`}
              role="tabpanel"
              aria-labelledby={`flow-tab-${activeStage.id}`}
              sx={{
                position: "relative",
                minWidth: 0,
                minHeight: { xs: 520, sm: 465, lg: 478 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                p: { xs: 2, sm: 2.4, md: 3 },
                background:
                  "radial-gradient(circle at 88% 12%, rgba(154,160,255,.16), transparent 32%), linear-gradient(180deg, #f8f8f6, #f3f4f7)",
                animation: reduceMotion
                  ? "none"
                  : "flowStageIn .42s cubic-bezier(.22,1,.36,1) both",
                "@keyframes flowStageIn": {
                  from: {
                    opacity: 0,
                    transform: "translateY(9px) scale(.995)",
                  },
                  to: { opacity: 1, transform: "translateY(0) scale(1)" },
                },
              }}
            >
              {STAGE_CONTENT[activeStage.id]}
            </Box>
          </Box>
        </Paper>
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: { xs: "block", md: "none" },
          textAlign: "center",
          mt: 1.5,
        }}
      >
        {t("home.showcase.stageSwitchHint")}
      </Typography>
    </Box>
  );
};

export default ExperienceFlowShowcase;
