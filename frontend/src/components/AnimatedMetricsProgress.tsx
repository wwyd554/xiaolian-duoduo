import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Tooltip,
  Collapse,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { visuallyHidden } from "@mui/utils";
import {
  getMetricsStatus,
  getFocusStyles,
  getAccessibleAnimation,
} from "../utils/accessibilityUtils";
import { useTranslation } from "react-i18next";

interface AnimatedMetricsProgressProps {
  value: number;
  prevValue?: number;
  label: string;
  icon?: string;
  maxValue?: number;
  color?: "primary" | "secondary" | "error" | "info" | "success" | "warning";
  isUpdating?: boolean;
  thresholdReached?: boolean;
  tooltipText?: string;
  detailedScores?: Record<string, number | undefined>;
  /**
   * 动画速度（毫秒）
   * 数值越小越快，越大越慢
   */
  animationSpeed?: number;
  /**
   * 达到阈值时的提示级别
   * 'none'：无提示
   * 'low'：低级别提示
   * 'medium'：中级别提示
   * 'high'：高级别提示
   */
  alertLevel?: "none" | "low" | "medium" | "high";
}

/**
 * 带动画的指标进度显示组件
 *
 * 以可视化方式显示实时评估指标，并用动画强调数值变化。
 * 已支持无障碍：屏幕阅读器兼容、键盘导航、
 * 已恰当设置考虑色觉异常的配色对比度及 ARIA 属性。
 */
const AnimatedMetricsProgress: React.FC<AnimatedMetricsProgressProps> = ({
  value,
  prevValue,
  label,
  icon = "",
  maxValue = 10,
  color = "primary",
  isUpdating = false,
  thresholdReached = false,
  tooltipText,
  detailedScores,
  animationSpeed = 30,
  alertLevel = "medium",
}) => {
  const { t } = useTranslation();
  // 动画用的当前值
  const [animatedValue, setAnimatedValue] = useState<number>(
    prevValue !== undefined ? prevValue : value,
  );

  // 以便能引用动画速度
  const animationSpeedRef = React.useRef(animationSpeed);
  // 数值变化时更新引用
  React.useEffect(() => {
    animationSpeedRef.current = animationSpeed;
  }, [animationSpeed]);

  // 正在上升还是下降
  const isIncreasing = prevValue !== undefined && value > prevValue;
  const isDecreasing = prevValue !== undefined && value < prevValue;

  // 动画用的状态
  const [isAnimating, setIsAnimating] = useState(false);
  const [pulseEffect, setPulseEffect] = useState(false);

  // 数值变化时播放动画
  useEffect(() => {
    if (prevValue !== undefined && prevValue !== value) {
      setIsAnimating(true);
      setPulseEffect(true);

      // 动画的步数
      const steps = 20;
      const increment = (value - prevValue) / steps;
      let currentStep = 0;

      const intervalId = setInterval(() => {
        if (currentStep < steps) {
          setAnimatedValue((prev) =>
            Math.min(maxValue, Math.max(0, prev + increment)),
          );
          currentStep++;
        } else {
          clearInterval(intervalId);
          setAnimatedValue(value);
          setIsAnimating(false);

          // 脉冲效果稍作延迟后结束
          setTimeout(() => setPulseEffect(false), 500);
        }
      }, animationSpeedRef.current); // 从引用使用当前动画速度

      return () => clearInterval(intervalId);
    }
  }, [value, prevValue, maxValue]);

  // 更新中也启用脉冲效果
  useEffect(() => {
    if (isUpdating) {
      setPulseEffect(true);
    } else if (!isAnimating) {
      setPulseEffect(false);
    }
  }, [isUpdating, isAnimating]);

  // 详细显示的开合状态
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 详细显示的切换
  const toggleDetails = () => {
    setDetailsOpen(!detailsOpen);
  };

  // 计算进度条的值（限制在 0-100 范围）
  const progressValue = (animatedValue / maxValue) * 100;

  // 判断指标的类型
  const getMetricType = (): "anger" | "trust" | "progress" => {
    if (label.includes("愤怒") || label.includes("anger")) {
      return "anger";
    } else if (label.includes("信任") || label.includes("trust")) {
      return "trust";
    } else {
      return "progress";
    }
  };

  // 根据指标的值动态设置颜色
  const getDynamicColor = () => {
    const metricType = getMetricType();
    if (metricType === "anger") {
      // 愤怒计的情况相反（越高越红）
      if (value >= 8) return "error";
      if (value >= 5) return "warning";
      return "success";
    } else {
      // 信任度或进度的情况（越高越绿）
      if (value >= 8) return "success";
      if (value >= 5) return "info";
      return "error";
    }
  };

  // 生成用于无障碍的状态说明文本
  const getAriaValueText = () => {
    const percentage = Math.round((value / maxValue) * 100);
    const metricType = getMetricType();
    const status = getMetricsStatus(value, metricType, t);

    return `${label}为${value}/${maxValue}，${percentage}百分比。状态：${status}`;
  };

  // 是否应用动态颜色
  const actualColor = color === "primary" ? getDynamicColor() : color;

  // 是否有详细得分
  const hasDetailedScores =
    detailedScores && Object.keys(detailedScores).length > 0;

  return (
    <Box
      sx={{
        width: "100%",
        mb: 2,
        position: "relative",
        "&::after":
          thresholdReached && alertLevel !== "none"
            ? {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: alertLevel === "high" ? "3px solid" : "2px solid",
              borderColor:
                alertLevel === "high"
                  ? "error.main"
                  : alertLevel === "medium"
                    ? "warning.main"
                    : "info.main",
              borderRadius: 1,
              animation: `pulse-border-${alertLevel} 1.5s infinite`,
              pointerEvents: "none",
              opacity: alertLevel === "high" ? 0.8 : 0.7,
            }
            : {},
        "@keyframes pulse-border-high": {
          "0%": { opacity: 0.8 },
          "50%": { opacity: 0.4 },
          "100%": { opacity: 0.8 },
        },
        "@keyframes pulse-border-medium": {
          "0%": { opacity: 0.7 },
          "50%": { opacity: 0.3 },
          "100%": { opacity: 0.7 },
        },
        "@keyframes pulse-border-low": {
          "0%": { opacity: 0.6 },
          "50%": { opacity: 0.2 },
          "100%": { opacity: 0.6 },
        },
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
        sx={{
          cursor: hasDetailedScores ? "pointer" : "default",
          "&:hover": hasDetailedScores
            ? { bgcolor: "rgba(0, 0, 0, 0.04)" }
            : {},
          "&:focus-visible": getFocusStyles(),
        }}
        onClick={hasDetailedScores ? toggleDetails : undefined}
        onKeyDown={(e) => {
          if (hasDetailedScores && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggleDetails();
          }
        }}
        role={hasDetailedScores ? "button" : undefined}
        tabIndex={hasDetailedScores ? 0 : undefined}
        aria-expanded={hasDetailedScores ? detailsOpen : undefined}
        aria-controls={
          hasDetailedScores
            ? `details-${label.replace(/\s+/g, "-")}`
            : undefined
        }
      >
        <Tooltip title={tooltipText || ""} arrow placement="top">
          <Typography variant="subtitle2" component="span">
            {icon} {label}
          </Typography>
        </Tooltip>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography
            variant="body2"
            fontWeight="bold"
            sx={{
              color: isIncreasing
                ? "success.main"
                : isDecreasing
                  ? "error.main"
                  : "inherit",
              ...(pulseEffect
                ? getAccessibleAnimation("pulse", 500)
                : { animation: "none" }),
              "@keyframes pulse": {
                "0%": { transform: "scale(1)" },
                "50%": { transform: "scale(1.2)" },
                "100%": { transform: "scale(1)" },
              },
            }}
          >
            {typeof animatedValue === "number"
              ? Number(animatedValue).toFixed(1)
              : typeof value === "number"
                ? Number(value).toFixed(1)
                : "0.0"}
            /{maxValue}
          </Typography>
          {hasDetailedScores &&
            (detailsOpen ? (
              <ExpandLess fontSize="small" />
            ) : (
              <ExpandMore fontSize="small" />
            ))}
        </Box>
      </Box>
      <Box position="relative">
        <Typography sx={visuallyHidden}>{getAriaValueText()}</Typography>
        <LinearProgress
          variant="determinate"
          value={progressValue}
          color={actualColor}
          sx={{
            height: 8,
            borderRadius: 4,
            transition: "all 0.5s ease",
            opacity: isUpdating ? 0.7 : 1,
            ...(isUpdating
              ? getAccessibleAnimation("pulse-opacity", 1000)
              : { animation: "none" }),
            "@keyframes pulse-opacity": {
              "0%": { opacity: 0.7 },
              "50%": { opacity: 1 },
              "100%": { opacity: 0.7 },
            },
          }}
          aria-valuemin={0}
          aria-valuemax={maxValue}
          aria-valuenow={value}
          aria-valuetext={getAriaValueText()}
          role="progressbar"
          aria-label={label}
        />
      </Box>

      {/* 详细得分的显示 */}
      {hasDetailedScores && (
        <Collapse in={detailsOpen} timeout="auto" unmountOnExit>
          <Box
            sx={{
              mt: 1,
              pl: 2,
              pr: 2,
              pb: 1,
              bgcolor: "rgba(0, 0, 0, 0.02)",
              borderRadius: 1,
            }}
            id={`details-${label.replace(/\s+/g, "-")}`}
            role="region"
            aria-label={`${label} 的详细得分`}
          >
            {Object.entries(detailedScores).map(([key, score]) => {
              // 将键名转换为显示用
              const displayName = key
                .replace(/Score$/, "")
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (str) => str.toUpperCase());

              return (
                <Box
                  key={key}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mt={0.5}
                >
                  <Typography variant="caption" color="text.secondary">
                    {displayName}
                  </Typography>
                  <Typography variant="caption" fontWeight="medium">
                    {score !== undefined ? `${score}/10` : "-/10"}
                  </Typography>
                </Box>
              );
            })}

            {/* 分析文本显示在公共区域，故从此处删除 */}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default AnimatedMetricsProgress;
