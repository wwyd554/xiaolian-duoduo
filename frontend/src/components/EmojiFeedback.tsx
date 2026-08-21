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
 * EmojiFeedbackコンポーネントのプロパティ
 */
export interface EmojiFeedbackProps {
  /** 怒りレベル (0-10) */
  angerLevel: number;
  /** 信頼度レベル (0-10) */
  trustLevel: number;
  /** 進捗度レベル (0-10) */
  progressLevel: number;
  /** 絵文字のサイズ */
  size?: "small" | "medium" | "large" | number;
  /** 絵文字の表示位置 */
  position?: "top" | "center" | "bottom";
  /** アニメーション有効/無効 */
  animationEnabled?: boolean;
  /** カスタム絵文字マッピング */
  customEmojis?: Record<EmotionState, string>;
  /** 感情状態変化時のコールバック */
  onEmotionChange?: (emotion: EmotionState) => void;
  /** アクセシビリティ用のラベルID */
  ariaLabelledBy?: string;
  /** アクセシビリティ用の説明ID */
  ariaDescribedBy?: string;
  /** カスタムスタイル */
  style?: React.CSSProperties;
  /** カスタムクラス名 */
  className?: string;
  /** テーマ設定 */
  theme?: "light" | "dark" | "auto";
  /** 高コントラストモード */
  highContrast?: boolean;
  /** キーボードフォーカス可能にする */
  focusable?: boolean;
  /** タブインデックス */
  tabIndex?: number;
  /** 状態変化通知の有効/無効 */
  announceStateChanges?: boolean;
}

// ---------------------------------------------------------------------------
// コンポーネント外部の定数定義（SG-005: @keyframesの外部化）
// ---------------------------------------------------------------------------

/** アニメーション用@keyframes定義（レンダリングごとの再生成を防止） */
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
 * EmojiFeedbackコンポーネント
 *
 * メトリクス（怒り、信頼度、進捗度）に基づいて感情状態を絵文字で表示するコンポーネント
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

  // ユニークID生成（複数インスタンス時のID衝突防止）
  const uniqueId = useId();

  // 感情状態の状態管理
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState>("neutral");
  // スクリーンリーダー用の通知メッセージ
  const [announcement, setAnnouncement] = useState<string>("");
  // コンポーネント参照
  const emojiRef = useRef<HTMLDivElement>(null);
  // 前回の感情状態をrefで管理（循環依存の排除）
  const currentEmotionRef = useRef<EmotionState>("neutral");
  // onEmotionChangeをrefで安定化（無限ループ防止）
  const onEmotionChangeRef = useRef(onEmotionChange);
  useEffect(() => {
    onEmotionChangeRef.current = onEmotionChange;
  }, [onEmotionChange]);

  // WR-001: emojiMap は useMemo のみで管理（useState + useEffect の冗長管理を排除）
  const emojiMap = useMemo(() => {
    return validateAndCompleteEmojiMap(customEmojis);
  }, [customEmojis]);

  // SG-004: getFontSize → fontSize に改名（useMemoの戻り値として適切な命名）
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

  // 位置に基づくスタイルの設定（メモ化）
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

  // デバイスのパフォーマンス情報を取得（静的部分のみキャッシュ）
  const staticPerformanceInfo = useMemo(() => {
    return getPerformanceInfo();
  }, []);

  // prefers-reduced-motion の動的変更を監視
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

  // 動的な prefersReducedMotion を統合したパフォーマンス情報
  const performanceInfo = useMemo(
    () => ({ ...staticPerformanceInfo, prefersReducedMotion }),
    [staticPerformanceInfo, prefersReducedMotion],
  );

  // WR-002: アニメーションタイプの選択（optimizeAnimation内部の二重呼び出しを排除）
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

    // 低スペックデバイス向けの簡易アニメーション
    if (performanceInfo.isLowEndDevice) {
      return baseAnimation.replace(/[\d.]+s/, "1.5s");
    }
    return baseAnimation;
  }, [animationEnabled, currentEmotion, performanceInfo]);

  // メトリクス変更時の感情状態計算（onEmotionChangeRef で無限ループ防止）
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

      // 感情状態変化時のコールバックを呼び出し（ref経由で安定化）
      onEmotionChangeRef.current?.(newEmotion);

      // スクリーンリーダー用の通知メッセージを設定
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

  // 現在の感情状態に対応する絵文字を取得（メモ化）
  const currentEmoji = useMemo(() => {
    return getEmojiForEmotion(currentEmotion, emojiMap);
  }, [currentEmotion, emojiMap]);

  // 現在の感情状態の説明テキスト（メモ化）
  const emotionDescription = useMemo(() => {
    return t(EMOTION_DESCRIPTION_KEYS[currentEmotion]);
  }, [currentEmotion, t]);

  // WR-002: システムテーマをstateで管理し、変更を監視する
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

  // WR-010: テーマと感情状態に基づくスタイルの設定（DRY化）
  const themeStyle = useMemo(() => {
    const emotionColor = EMOTION_COLORS[currentEmotion];
    const borderStyle =
      currentEmotion === "angry" || currentEmotion === "annoyed"
        ? "dashed"
        : "solid";

    // 高コントラストモードの場合
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

    // dark/light判定を統合（auto時はprefersDarkMode stateを参照）
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

  // キーボードイベントハンドラー（コールバックとしてメモ化）
  // SG-002: setAnnouncementは安定した参照のため依存配列から除外
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setAnnouncement(t(EMOTION_DETAILED_DESCRIPTION_KEYS[currentEmotion]));
      }
    },
    [currentEmotion, t],
  );

  // WR-009: aria-haspopup削除、aria-labelを維持
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

  // クリックハンドラー（メモ化）
  const handleClick = useCallback(() => {
    if (focusable) {
      setAnnouncement(t(EMOTION_DETAILED_DESCRIPTION_KEYS[currentEmotion]));
    }
  }, [focusable, currentEmotion, t]);

  // ユニークIDでaria-describedby/labelledbyの衝突を防止
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
          // モバイルデバイスの最適化
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
          // 低スペックデバイスの最適化
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

      {/* 感情状態を表すテキストラベル（色覚異常者向けの追加情報） */}
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

      {/* スクリーンリーダー用の説明テキスト（WR-008: 統一されたID） */}
      <Typography id={descriptionId} sx={{ ...visuallyHidden }}>
        {t("emotion.currentState", { state: emotionDescription })}
      </Typography>

      {/* 詳細な説明テキスト */}
      <Typography id={detailId} sx={{ ...visuallyHidden }}>
        {t(EMOTION_DETAILED_DESCRIPTION_KEYS[currentEmotion])}
      </Typography>

      {/* WR-007: 状態変化通知用の領域（aria-liveはここのみに設定） */}
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

      {/* アクセシビリティ用の隠し要素（ユニークID） */}
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
// SG-003: スタイルオブジェクトの浅い比較（JSON.stringify を排除）
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

// パフォーマンス最適化のためにメモ化
// カスタム比較関数を定義して不要な再レンダリングを防止
const arePropsEqual = (
  prevProps: EmojiFeedbackProps,
  nextProps: EmojiFeedbackProps,
) => {
  // 怒り閾値をまたぐ変化は即座に反映
  const crossesAngerThreshold =
    (prevProps.angerLevel < ANGER_THRESHOLD &&
      nextProps.angerLevel >= ANGER_THRESHOLD) ||
    (prevProps.angerLevel >= ANGER_THRESHOLD &&
      nextProps.angerLevel < ANGER_THRESHOLD);
  if (crossesAngerThreshold) {
    return false;
  }

  // 信頼度の閾値をまたぐ変化も即座に反映（satisfied/happy状態への遷移を見逃さない）
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

  // メトリクス値の変更を確認（ヒステリシスを考慮）
  const METRICS_THRESHOLD = 0.2;
  if (
    Math.abs(prevProps.angerLevel - nextProps.angerLevel) > METRICS_THRESHOLD ||
    Math.abs(prevProps.trustLevel - nextProps.trustLevel) > METRICS_THRESHOLD ||
    Math.abs(prevProps.progressLevel - nextProps.progressLevel) >
    METRICS_THRESHOLD
  ) {
    return false;
  }

  // サイズや位置などの表示設定の変更を確認
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

  // カスタム絵文字マッピングの変更を確認
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

  // SG-003: スタイルやクラス名の変更を確認（shallow comparison）
  if (
    prevProps.className !== nextProps.className ||
    !shallowEqualStyle(prevProps.style, nextProps.style)
  ) {
    return false;
  }

  // コールバック以外のアクセシビリティpropsの変更を検出
  // （onEmotionChangeはref化したため参照比較不要）
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
