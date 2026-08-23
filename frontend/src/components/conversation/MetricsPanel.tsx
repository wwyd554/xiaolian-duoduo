import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Collapse,
} from "@mui/material";
import AnimatedMetricsProgress from "../AnimatedMetricsProgress";
import { Metrics } from "../../types/index";
import { useTranslation } from "react-i18next";

interface MetricsPanelProps {
  currentMetrics: Metrics;
  prevMetrics: Metrics | null;
  metricsUpdating: boolean;
}

/**
 * 指标展示面板组件（仅 3 个基础指标）
 * Display panel for basic metrics (only 3 fundamental metrics)
 */
const MetricsPanel: React.FC<MetricsPanelProps> = ({
  currentMetrics,
  prevMetrics,
  metricsUpdating,
}) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent sx={{ p: 1.5 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={1}
          role="region"
          aria-labelledby="realtime-metrics-heading"
        >
          <Typography
            variant="h6"
            sx={{
              writingMode: "horizontal-tb",
              whiteSpace: "nowrap",
              overflow: "visible",
              fontSize: "1rem",
            }}
            id="realtime-metrics-heading"
          >
            {t("metrics.realtimeEvaluation")}
          </Typography>

          {/* 回退模式显示已删除 */}
        </Box>

        {/* 综合得分已删除 */}
        <Divider sx={{ my: 1 }} />

        {/* 愤怒计 */}
        <AnimatedMetricsProgress
          value={currentMetrics.angerLevel}
          prevValue={prevMetrics?.angerLevel}
          label={`😡 ${t("metrics.angerMeter")}`}
          color="error"
          isUpdating={metricsUpdating}
          thresholdReached={currentMetrics.angerLevel >= 8}
          alertLevel="high"
          tooltipText={t("metrics.angerMeterTooltip")}
        />

        {/* 信頼度 */}
        <AnimatedMetricsProgress
          value={currentMetrics.trustLevel}
          prevValue={prevMetrics?.trustLevel}
          label={`🤝 ${t("metrics.trustLevel")}`}
          color="primary"
          isUpdating={metricsUpdating}
          thresholdReached={currentMetrics.trustLevel <= 3}
          alertLevel="medium"
          tooltipText={t("metrics.trustLevelTooltip")}
        />

        {/* 商談進捗度 */}
        <AnimatedMetricsProgress
          value={currentMetrics.progressLevel}
          prevValue={prevMetrics?.progressLevel}
          label={`📈 ${t("metrics.progressLevel")}`}
          color="primary"
          isUpdating={metricsUpdating}
          tooltipText={t("metrics.progressLevelTooltip")}
          animationSpeed={40}
        />

        {/* 分析文本显示区域 */}
        <Collapse
          in={
            currentMetrics.analysis !== undefined &&
            currentMetrics.analysis !== ""
          }
        >
          {currentMetrics.analysis && (
            <Box
              sx={{
                mt: 1,
                p: 1,
                bgcolor: "rgba(0, 0, 0, 0.03)",
                borderRadius: 1,
                border: "1px dashed rgba(0, 0, 0, 0.1)",
              }}
              role="region"
              aria-label={t("metrics.analysisResult")}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontStyle: "italic", fontSize: "0.75rem" }}
              >
                <strong>{t("metrics.analysis")}:</strong>{" "}
                {currentMetrics.analysis}
              </Typography>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default MetricsPanel;
