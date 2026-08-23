import React, {
  useState,
  useEffect,
  memo,
  useRef,
  useMemo,
  useCallback,
  useId,
} from "react";
import { getPerformanceInfo } from "../utils/performanceUtils";
import { Box, Typography } from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { EmotionState } from "../types/index";
import {
  calculateEmotionState,
  getEmojiForEmotion,
  validateAndCompleteEmojiMap,
  EMOTION_DESCRIPTION_KEYS,
  EMOTION_DETAILED_DESCRIPTION_KEYS,
  EMOTION_COLORS,
  ANGER_THRESHOLD,
  SATISFIED_TRUST_THRESHOLD,
  HAPPY_TRUST_THRESHOLD,
} from "../utils/emotionUtils";
import { useTranslation } from "react-i18next";
import { getFocusStyles } from "../utils/accessibilityUtils";

/**
 * EmojiFeedback 组件的属性
 */
export interface EmojiFeedbackProps {
  /** 愤怒等级 (0-10) */
  angerLevel: number;
  /** 信任度等级 (0-10) */
  trustLevel: number;
  /** 进度等级 (0-10) */
  progressLevel: number;
  /** 表情符号的大小 */
  size?: "small" | "medium" | "large" | number;
  /** 表情符号的显示位置 */
  position?: "top" | "center" | "bottom";
  /** 动画启用/禁用 */
  animationEnabled?: boolean;
  /** 自定义表情符号映射 */
  customEmojis?: Record<EmotionState, string>;
  /** 感情状态变化时的回调 */
  onEmotionChange?: (emotion: EmotionState) => void;
  /** 无障碍用的标签 ID */
  ariaLabelledBy?: string;
  /** 无障碍用的说明 ID */
  ariaDescribedBy?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义类名 */
  className?: string;
  /** 主题设置 */
  theme?: "light" | "dark" | "auto";
  /** 高对比度模式 */
  highContrast?: boolean;
  /** 允许键盘聚焦 */
  focusable?: boolean;
  /** 标签索引 */
  tabIndex?: number;
  /** 状态变化通知的启用/禁用 */
  announceStateChanges?: boolean;
}

// ---------------------------------------------------------------------------
// 组件外部的常量定义（SG-005: @keyframes 外部化）
// ---------------------------------------------------------------------------

/** 动画用的 @keyframes 定义（防止每次渲染时重新生成） */
const KEYFRAMES = {
  "@keyframes pulse": {
    "0%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.1)" },
    "100%": { transform: "scale(1)" },
  },
  "@keyframes shake": {
    "0%, 100%": { transform: "translateX(0)" },
    "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
    "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
  },
  "@keyframes bounce": {
    "0%, 20%, 50%, 80%, 100%": { transform: "translateY(0)" },
    "40%": { transform: "translateY(-20px)" },
    "60%": { transform: "translateY(-10px)" },
  },
} as const;

/**
 * EmojiFeedback 组件
 *
 * 根据指标（愤怒、信任度、进度）以表情符号显示感情状态的组件
 */
const EmojiFeedback: React.FC<EmojiFeedbackProps> = ({
  angerLevel,
  trustLevel,
  progressLevel,
  size = "medium",
  position = "center",
  animationEnabled = true,
  customEmojis,
  onEmotionChange,
  ariaLabelledBy,
  ariaDescribedBy,
  style,
  className,
  theme = "light",
  highContrast = false,
  focusable = false,
  tabIndex = -1,
  announceStateChanges = true,
}) => {
  const { t } = useTranslation();

  // 生成唯一 ID（防止多个实例时的 ID 冲突）
  const uniqueId = useId();

  // 感情状态的状态管理
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState>("neutral");
  // 屏幕阅读器用的通知消息
  const [announcement, setAnnouncement] = useState<string>("");
  // 组件引用
  const emojiRef = useRef<HTMLDivElement>(null);
  // 用 ref 管理上次的感情状态（排除循环依赖）
  const currentEmotionRef = useRef<EmotionState>("neutral");
  // 用 ref 稳定 onEmotionChange（防止无限循环）
  const onEmotionChangeRef = useRef(onEmotionChange);
  useEffect(() => {
    onEmotionChangeRef.current = onEmotionChange;
  }, [onEmotionChange]);

  // WR-001: emojiMap 仅用 useMemo 管理（排除 useState + useEffect 的冗余管理）
  const emojiMap = useMemo(() => {
    return validateAndCompleteEmojiMap(customEmojis);
  }, [customEmojis]);

  // SG-004: getFontSize → 改名为 fontSize（作为 useMemo 返回值的恰当命名）
  const fontSize = useMemo(() => {
    if (typeof size === "number") {
      return `${size}rem`;
    }
    switch (size) {
      case "small":
        return "2rem";
      case "large":
        return "6rem";
      case "medium":
      default:
        return "4rem";
    }
  }, [size]);

  // 基于位置的样式设置（记忆化）
  const positionStyle = useMemo(() => {
    switch (position) {
      case "top":
        return { alignItems: "flex-start" };
      case "bottom":
        return { alignItems: "flex-end" };
      case "center":
      default:
        return { alignItems: "center" };
    }
  }, [position]);

  // 获取设备的性能信息（仅缓存静态部分）
  const staticPerformanceInfo = useMemo(() => {
    return getPerformanceInfo();
  }, []);

  // 监听 prefers-reduced-motion 的动态变化
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 整合动态 prefersReducedMotion 的性能信息
  const performanceInfo = useMemo(
    () => ({ ...staticPerformanceInfo, prefersReducedMotion }),
    [staticPerformanceInfo, prefersReducedMotion],
  );

  // WR-002: 动画类型的选择（排除 optimizeAnimation 内部的重复调用）
  const animationType = useMemo(() => {
    if (!animationEnabled || performanceInfo.prefersReducedMotion) return "none";

    let baseAnimation = "none";
    switch (currentEmotion) {
      case "angry":
        baseAnimation = "shake 0.8s ease-in-out";
        break;
      case "annoyed":
        baseAnimation = "shake 0.5s ease-in-out";
        break;
      case "happy":
        baseAnimation = "bounce 1s ease-in-out";
        break;
      case "satisfied":
        baseAnimation = "pulse 1s ease-in-out";
        break;
      case "neutral":
      default:
        return "none";
    }

    // 面向低配设备的简易动画
    if (performanceInfo.isLowEndDevice) {
      return baseAnimation.replace(/[\d.]+s/, "1.5s");
    }
    return baseAnimation;
  }, [animationEnabled, currentEmotion, performanceInfo]);

  // 指标变化时的感情状态计算（通过 onEmotionChangeRef 防止无限循环）
  useEffect(() => {
    const newEmotion = calculateEmotionState({
      angerLevel,
      trustLevel,
      progressLevel,
      previousEmotion: currentEmotionRef.current,
    });

    if (newEmotion !== currentEmotionRef.current) {
      const fromEmotion = currentEmotionRef.current;
      currentEmotionRef.current = newEmotion;
      setCurrentEmotion(newEmotion);

      // 调用感情状态变化时的回调（通过 ref 稳定化）
      onEmotionChangeRef.current?.(newEmotion);

      // 设置屏幕阅读器用的通知消息
      if (announceStateChanges) {
        const fromText = t(EMOTION_DESCRIPTION_KEYS[fromEmotion]);
        const toText = t(EMOTION_DESCRIPTION_KEYS[newEmotion]);
        const changeMessage = t("emotion.changed", {
          from: fromText,
          to: toText,
        });
        setAnnouncement(changeMessage);
      }
    }
  }, [angerLevel, trustLevel, progressLevel, announceStateChanges, t]);

  // 获取当前感情状态对应的表情符号（记忆化）
  const currentEmoji = useMemo(() => {
    return getEmojiForEmotion(currentEmotion, emojiMap);
  }, [currentEmotion, emojiMap]);

  // 当前感情状态的说明文本（记忆化）
  const emotionDescription = useMemo(() => {
    return t(EMOTION_DESCRIPTION_KEYS[currentEmotion]);
  }, [currentEmotion, t]);

  // WR-002: 用 state 管理系统主题并监听变化
  const [prefersDarkMode, setPrefersDarkMode] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (theme !== "auto") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDarkMode(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  // WR-010: 基于主题和感情状态的样式设置（DRY 化）
  const themeStyle = useMemo(() => {
    const emotionColor = EMOTION_COLORS[currentEmotion];
    const borderStyle =
      currentEmotion === "angry" || currentEmotion === "annoyed"
        ? "dashed"
        : "solid";

    // 高对比度模式的情况
    if (highContrast) {
      return {
        backgroundColor: "#000000",
        color: emotionColor.highContrast,
        borderRadius: "8px",
        padding: "12px",
        border: "2px solid #ffffff",
        boxShadow: "0 0 0 2px #000000",
        textShadow: "0 0 2px rgba(255, 255, 255, 0.5)",
        outline: `4px ${borderStyle} #ffffff`,
        outlineOffset: "2px",
      };
    }

    // 整合 dark/light 判定（auto 时参考 prefersDarkMode 状态）
    const isDark =
      theme === "dark" || (theme === "auto" && prefersDarkMode);
    const colorVariant = isDark ? "dark" : "light";

    return {
      backgroundColor: isDark
        ? "rgba(30, 30, 30, 0.9)"
        : "rgba(255, 255, 255, 0.9)",
      color: emotionColor[colorVariant],
      borderRadius: "8px",
      padding: "8px",
      textShadow: isDark
        ? "0 0 2px rgba(255, 255, 255, 0.3)"
        : "0 0 1px rgba(0, 0, 0, 0.3)",
      border: `2px ${borderStyle} ${emotionColor[colorVariant]}`,
    };
  }, [currentEmotion, theme, highContrast, prefersDarkMode]);

  // 键盘事件处理器（作为回调记忆化）
  // SG-002: setAnnouncement 为稳定引用，故从依赖数组中排除
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setAnnouncement(t(EMOTION_DETAILED_DESCRIPTION_KEYS[currentEmotion]));
      }
    },
    [currentEmotion, t],
  );

  // WR-009: 删除 aria-haspopup，保留 aria-label
  const focusableProps = useMemo(() => {
    if (!focusable) return {};

    return {
      tabIndex: tabIndex,
      onKeyDown: handleKeyDown,
      "aria-label": t("emotion.stateWithValue", {
        state: t(EMOTION_DESCRIPTION_KEYS[currentEmotion]),
      }),
      sx: {
        "&:focus": getFocusStyles(),
        "&:focus-visible": getFocusStyles(),
        cursor: "pointer",
        "&:hover": {
          opacity: 0.9,
          transform: "scale(1.05)",
          transition: "transform 0.2s ease-in-out",
        },
        "@media (prefers-reduced-motion: reduce)": {
          "&:hover": {
            transform: "none",
            transition: "none",
          },
        },
      },
    };
  }, [focusable, tabIndex, handleKeyDown, currentEmotion, t]);

  // 点击处理器（记忆化）
  const handleClick = useCallback(() => {
    if (focusable) {
      setAnnouncement(t(EMOTION_DETAILED_DESCRIPTION_KEYS[currentEmotion]));
    }
  }, [focusable, currentEmotion, t]);

  // 用唯一 ID 防止 aria-describedby/labelledby 冲突
  const labelId = ariaLabelledBy || `emoji-feedback-label-${uniqueId}`;
  const descriptionId = ariaDescribedBy || `emoji-feedback-desc-${uniqueId}`;
  const detailId = `${descriptionId}-detail`;

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      {...positionStyle}
      height="100%"
      component="div"
      role={focusable ? "button" : "img"}
      aria-labelledby={labelId}
      aria-describedby={`${descriptionId} ${detailId}`}
      className={className}
      ref={emojiRef}
      onClick={handleClick}
      sx={{
        ...themeStyle,
        ...style,
        ...(focusable && focusableProps.sx),
      }}
      {...(focusable
        ? {
          tabIndex: focusableProps.tabIndex,
          onKeyDown: focusableProps.onKeyDown,
          "aria-label": focusableProps["aria-label"],
        }
        : {})}
    >
      <Typography
        variant="h1"
        component="div"
        aria-hidden="true"
        sx={{
          fontSize: fontSize,
          lineHeight: 1,
          textAlign: "center",
          transition: animationEnabled ? "transform 0.3s ease-in-out" : "none",
          animation: animationType,
          ...KEYFRAMES,
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            transition: "none",
          },
          // 移动设备的优化
          "@media (max-width: 600px)": {
            fontSize:
              typeof size === "number"
                ? `${size * 0.8}rem`
                : size === "large"
                  ? "4.8rem"
                  : size === "medium"
                    ? "3.2rem"
                    : "1.6rem",
          },
          // 低配设备的优化
          ...(performanceInfo.isLowEndDevice
            ? {
              animationDuration: "1.5s",
              animationTimingFunction: "linear",
            }
            : {}),
          willChange:
            animationEnabled && !performanceInfo.isLowEndDevice
              ? "transform"
              : "auto",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          touchAction: "manipulation",
          textRendering: "optimizeSpeed",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {currentEmoji}
      </Typography>

      {/* 表示感情状态的文本标签（面向色觉异常者的附加信息） */}
      <Typography
        variant="caption"
        component="div"
        sx={{
          fontSize: "0.8rem",
          textAlign: "center",
          marginTop: "4px",
          fontWeight: "bold",
          display: highContrast ? "block" : "none",
        }}
      >
        {t(EMOTION_DESCRIPTION_KEYS[currentEmotion])}
      </Typography>

      {/* 屏幕阅读器用的说明文本（WR-008: 统一 ID） */}
      <Typography id={descriptionId} sx={{ ...visuallyHidden }}>
        {t("emotion.currentState", { state: emotionDescription })}
      </Typography>

      {/* 详细说明文本 */}
      <Typography id={detailId} sx={{ ...visuallyHidden }}>
        {t(EMOTION_DETAILED_DESCRIPTION_KEYS[currentEmotion])}
      </Typography>

      {/* WR-007: 状态变化通知区域（aria-live 仅在此处设置） */}
      {announceStateChanges && (
        <div
          aria-live="polite"
          aria-atomic="true"
          role="status"
          style={visuallyHidden as React.CSSProperties}
        >
          {announcement}
        </div>
      )}

      {/* 无障碍用的隐藏元素（唯一 ID） */}
      <span
        id={labelId}
        style={visuallyHidden as React.CSSProperties}
      >
        {t("emotion.feedbackLabel")}
      </span>
      <span
        id={`${descriptionId}-extra`}
        style={visuallyHidden as React.CSSProperties}
      >
        {emotionDescription}
      </span>
      <span
        id={`${detailId}-extra`}
        style={visuallyHidden as React.CSSProperties}
      >
        {t(EMOTION_DETAILED_DESCRIPTION_KEYS[currentEmotion])}
      </span>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// SG-003: 样式对象的浅比较（排除 JSON.stringify）
// ---------------------------------------------------------------------------
const shallowEqualStyle = (
  a?: React.CSSProperties,
  b?: React.CSSProperties,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a) as (keyof React.CSSProperties)[];
  const keysB = Object.keys(b) as (keyof React.CSSProperties)[];
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
};

// 为性能优化而记忆化
// 定义自定义比较函数以防不必要的重新渲染
const arePropsEqual = (
  prevProps: EmojiFeedbackProps,
  nextProps: EmojiFeedbackProps,
) => {
  // 跨越愤怒阈值的变化立即生效
  const crossesAngerThreshold =
    (prevProps.angerLevel < ANGER_THRESHOLD &&
      nextProps.angerLevel >= ANGER_THRESHOLD) ||
    (prevProps.angerLevel >= ANGER_THRESHOLD &&
      nextProps.angerLevel < ANGER_THRESHOLD);
  if (crossesAngerThreshold) {
    return false;
  }

  // 跨越信任度阈值的变化也立即生效（不遗漏向 satisfied/happy 状态的迁移）
  const TRUST_THRESHOLDS = [SATISFIED_TRUST_THRESHOLD, HAPPY_TRUST_THRESHOLD];
  const crossesTrustThreshold = TRUST_THRESHOLDS.some(
    (threshold) =>
      (prevProps.trustLevel < threshold &&
        nextProps.trustLevel >= threshold) ||
      (prevProps.trustLevel >= threshold &&
        nextProps.trustLevel < threshold),
  );
  if (crossesTrustThreshold) {
    return false;
  }

  // 确认指标值的变化（考虑迟滞）
  const METRICS_THRESHOLD = 0.2;
  if (
    Math.abs(prevProps.angerLevel - nextProps.angerLevel) > METRICS_THRESHOLD ||
    Math.abs(prevProps.trustLevel - nextProps.trustLevel) > METRICS_THRESHOLD ||
    Math.abs(prevProps.progressLevel - nextProps.progressLevel) >
    METRICS_THRESHOLD
  ) {
    return false;
  }

  // 确认大小、位置等显示设置的变化
  if (
    prevProps.size !== nextProps.size ||
    prevProps.position !== nextProps.position ||
    prevProps.animationEnabled !== nextProps.animationEnabled ||
    prevProps.theme !== nextProps.theme ||
    prevProps.highContrast !== nextProps.highContrast ||
    prevProps.focusable !== nextProps.focusable
  ) {
    return false;
  }

  // 确认自定义表情符号映射的变化
  if (prevProps.customEmojis || nextProps.customEmojis) {
    if (
      (!prevProps.customEmojis && nextProps.customEmojis) ||
      (prevProps.customEmojis && !nextProps.customEmojis)
    ) {
      return false;
    }

    if (prevProps.customEmojis && nextProps.customEmojis) {
      const prevEmojis = prevProps.customEmojis;
      const nextEmojis = nextProps.customEmojis;
      const emotionStates: EmotionState[] = [
        "angry",
        "annoyed",
        "neutral",
        "satisfied",
        "happy",
      ];

      for (const state of emotionStates) {
        if (prevEmojis[state] !== nextEmojis[state]) {
          return false;
        }
      }
    }
  }

  // SG-003: 确认样式和类名的变化（浅比较）
  if (
    prevProps.className !== nextProps.className ||
    !shallowEqualStyle(prevProps.style, nextProps.style)
  ) {
    return false;
  }

  // 检测回调以外的无障碍 props 的变化
  // （onEmotionChange 已 ref 化，无需引用比较）
  if (prevProps.announceStateChanges !== nextProps.announceStateChanges) {
    return false;
  }
  if (
    prevProps.ariaLabelledBy !== nextProps.ariaLabelledBy ||
    prevProps.ariaDescribedBy !== nextProps.ariaDescribedBy
  ) {
    return false;
  }
  if (prevProps.tabIndex !== nextProps.tabIndex) {
    return false;
  }

  return true;
};

export default memo(EmojiFeedback, arePropsEqual);
