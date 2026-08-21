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
   * アニメーションの速度（ミリ秒）
   * 値が小さいほど速く、大きいほど遅くなります
   */
  animationSpeed?: number;
  /**
   * 閾値に達した時のアラートレベル
   * 'none': アラートなし
   * 'low': 低レベルアラート
   * 'medium': 中レベルアラート
   * 'high': 高レベルアラート
   */
  alertLevel?: "none" | "low" | "medium" | "high";
}

/**
 * アニメーション付きメトリクス進捗表示コンポーネント
 *
 * リアルタイム評価指標を視覚的に表示し、値の変化をアニメーションで強調します。
 * アクセシビリティ対応済み：スクリーンリーダー互換、キーボードナビゲーション、
 * 色覚異常を考慮した色のコントラスト、ARIA属性を適切に設定しています。
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
  // アニメーション用の現在値
  const [animatedValue, setAnimatedValue] = useState<number>(
    prevValue !== undefined ? prevValue : value,
  );

  // アニメーション速度を参照できるように
  const animationSpeedRef = React.useRef(animationSpeed);
  // 値が変わったら参照を更新
  React.useEffect(() => {
    animationSpeedRef.current = animationSpeed;
  }, [animationSpeed]);

  // 上昇中か下降中か
  const isIncreasing = prevValue !== undefined && value > prevValue;
  const isDecreasing = prevValue !== undefined && value < prevValue;

  // アニメーション用の状態
  const [isAnimating, setIsAnimating] = useState(false);
  const [pulseEffect, setPulseEffect] = useState(false);

  // 値が変わったらアニメーションする
  useEffect(() => {
    if (prevValue !== undefined && prevValue !== value) {
      setIsAnimating(true);
      setPulseEffect(true);

      // アニメーションのステップ数
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

          // パルスエフェクトを少し遅れて終了
          setTimeout(() => setPulseEffect(false), 500);
        }
      }, animationSpeedRef.current); // 参照から現在のアニメーション速度を使用

      return () => clearInterval(intervalId);
    }
  }, [value, prevValue, maxValue]);

  // 更新中の場合もパルスエフェクトを有効にする
  useEffect(() => {
    if (isUpdating) {
      setPulseEffect(true);
    } else if (!isAnimating) {
      setPulseEffect(false);
    }
  }, [isUpdating, isAnimating]);

  // 詳細表示の開閉状態
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 詳細表示の切り替え
  const toggleDetails = () => {
    setDetailsOpen(!detailsOpen);
  };

  // プログレスバーの値を計算（0-100の範囲にする）
  const progressValue = (animatedValue / maxValue) * 100;

  // メトリクスの種類を判定
  const getMetricType = (): "anger" | "trust" | "progress" => {
    if (label.includes("怒り") || label.includes("anger")) {
      return "anger";
    } else if (label.includes("信頼") || label.includes("trust")) {
      return "trust";
    } else {
      return "progress";
    }
  };

  // メトリクスの値に基づいて色を動的に設定
  const getDynamicColor = () => {
    const metricType = getMetricType();
    if (metricType === "anger") {
      // 怒りメーターの場合は逆になる（高いほど赤）
      if (value >= 8) return "error";
      if (value >= 5) return "warning";
      return "success";
    } else {
      // 信頼度や進捗度の場合（高いほど緑）
      if (value >= 8) return "success";
      if (value >= 5) return "info";
      return "error";
    }
  };

  // アクセシビリティのための状態説明テキストを生成
  const getAriaValueText = () => {
    const percentage = Math.round((value / maxValue) * 100);
    const metricType = getMetricType();
    const status = getMetricsStatus(value, metricType, t);

    return `${label}は${value}/${maxValue}で、${percentage}パーセント。状態: ${status}`;
  };

  // 動的な色を適用するかどうか
  const actualColor = color === "primary" ? getDynamicColor() : color;

  // 詳細スコアがあるかどうか
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

      {/* 詳細スコアの表示 */}
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
            aria-label={`${label}の詳細スコア`}
          >
            {Object.entries(detailedScores).map(([key, score]) => {
              // キー名を表示用に変換
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

            {/* 分析テキストは共通エリアに表示するため、ここから削除 */}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default AnimatedMetricsProgress;
