import React from "react";
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
} from "@mui/material";
import PsychologyAltRoundedIcon from "@mui/icons-material/PsychologyAltRounded";
import type { Metrics } from "../../types/index";
import { useTranslation } from "react-i18next";

interface MetricsOverlayProps {
  currentMetrics: Metrics;
  prevMetrics: Metrics | null;
  metricsUpdating: boolean;
  visible: boolean;
}

const clampMetric = (value: number) =>
  Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : 0;

/**
 * 实时指标组件。
 * 采用平铺信息行，便于在紧凑侧栏内快速扫读，不再表现为悬浮覆盖卡片。
 */
const MetricsOverlay: React.FC<MetricsOverlayProps> = ({
  currentMetrics,
  prevMetrics,
  metricsUpdating,
  visible,
}) => {
  const { t } = useTranslation();

  if (!visible) return null;

  const metrics = [
    {
      key: "anger",
      label: t("metrics.angerMeter"),
      hint: t("conversation.workspace.lowerIsBetter"),
      value: clampMetric(currentMetrics.angerLevel),
      previousValue: prevMetrics ? clampMetric(prevMetrics.angerLevel) : null,
      higherIsBetter: false,
      color: "#e05a47",
      trackColor: "#f9e8e5",
    },
    {
      key: "trust",
      label: t("metrics.trustLevel"),
      hint: t("conversation.workspace.trustHint"),
      value: clampMetric(currentMetrics.trustLevel),
      previousValue: prevMetrics ? clampMetric(prevMetrics.trustLevel) : null,
      higherIsBetter: true,
      color: "#2b59d1",
      trackColor: "#e6ecfb",
    },
    {
      key: "progress",
      label: t("metrics.progressLevel"),
      hint: t("conversation.workspace.progressHint"),
      value: clampMetric(currentMetrics.progressLevel),
      previousValue: prevMetrics
        ? clampMetric(prevMetrics.progressLevel)
        : null,
      higherIsBetter: true,
      color: "#16836f",
      trackColor: "#e3f3ef",
    },
  ];

  return (
    <Box
      role="region"
      aria-label={t("metrics.overlay.title")}
      aria-busy={metricsUpdating}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.25,
        }}
      >
        <Box>
          <Typography
            component="h3"
            sx={{ fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.35 }}
          >
            {t("conversation.workspace.metricsTitle")}
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              color: "text.secondary",
              fontSize: "0.6875rem",
              lineHeight: 1.45,
            }}
          >
            {t("conversation.workspace.metricsSubtitle")}
          </Typography>
        </Box>

        <Box
          sx={{
            minWidth: 64,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.75,
            color: metricsUpdating ? "primary.main" : "text.secondary",
          }}
        >
          {metricsUpdating ? (
            <CircularProgress size={11} thickness={5} aria-hidden="true" />
          ) : (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: "#2fa77e",
              }}
              aria-hidden="true"
            />
          )}
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600 }}>
            {metricsUpdating
              ? t("conversation.workspace.updating")
              : t("conversation.workspace.synced")}
          </Typography>
        </Box>
      </Box>

      <Box component="ul" sx={{ p: 0, m: 0, listStyle: "none" }}>
        {metrics.map((metric, index) => {
          const delta =
            metric.previousValue === null
              ? null
              : metric.value - metric.previousValue;
          const isImprovement =
            delta !== null &&
            delta !== 0 &&
            (metric.higherIsBetter ? delta > 0 : delta < 0);

          return (
            <Box
              component="li"
              key={metric.key}
              sx={{
                py: 1.5,
                borderTop: index === 0 ? "1px solid" : 0,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 1,
                  mb: 0.75,
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 0.75,
                  }}
                >
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 650 }}>
                    {metric.label}
                  </Typography>
                  <Typography
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.625rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {metric.hint}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 0.5,
                    flexShrink: 0,
                  }}
                >
                  {delta !== null && delta !== 0 ? (
                    <Typography
                      component="span"
                      sx={{
                        color: isImprovement ? "#16836f" : "#d15242",
                        fontSize: "0.625rem",
                        fontWeight: 700,
                      }}
                      aria-label={t(
                        delta > 0
                          ? "conversation.workspace.deltaUp"
                          : "conversation.workspace.deltaDown",
                        { value: Math.abs(delta) },
                      )}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </Typography>
                  ) : null}
                  <Typography
                    component="span"
                    sx={{
                      color: metric.color,
                      fontSize: "1rem",
                      fontWeight: 750,
                    }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ color: "text.disabled", fontSize: "0.625rem" }}
                  >
                    / 10
                  </Typography>
                </Box>
              </Box>

              <LinearProgress
                variant="determinate"
                value={metric.value * 10}
                aria-label={metric.label}
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={metric.value}
                sx={{
                  height: 5,
                  borderRadius: 999,
                  bgcolor: metric.trackColor,
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    bgcolor: metric.color,
                    transition: "transform 420ms ease",
                  },
                  "@media (prefers-reduced-motion: reduce)": {
                    "& .MuiLinearProgress-bar": { transition: "none" },
                  },
                }}
              />
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          mt: 2,
          px: 1.5,
          py: 1.25,
          borderLeft: "3px solid",
          borderColor: "primary.main",
          bgcolor: "rgba(43, 89, 209, 0.055)",
        }}
        aria-live="polite"
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
          <PsychologyAltRoundedIcon
            sx={{ width: 16, height: 16, color: "primary.main" }}
            aria-hidden="true"
          />
          <Typography
            sx={{
              color: "primary.main",
              fontSize: "0.6875rem",
              fontWeight: 750,
              letterSpacing: "0.06em",
            }}
          >
            {t("conversation.workspace.coachObservation")}
          </Typography>
        </Box>
        <Typography
          sx={{
            color: currentMetrics.analysis ? "text.primary" : "text.secondary",
            fontSize: "0.75rem",
            lineHeight: 1.65,
          }}
        >
          {currentMetrics.analysis ||
            t("conversation.workspace.coachObservationEmpty")}
        </Typography>
      </Box>
    </Box>
  );
};

export default MetricsOverlay;
