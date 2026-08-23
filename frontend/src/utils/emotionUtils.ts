/**
 * 情感状态计算工具
 *
 * 从指标（怒气、信任度、进度）计算情感状态，
 * 并提供对应表情的实用函数集。
 *
 * @module emotionUtils
 * @author AI 销售角色扮演开发团队
 * @version 2.0.0
 * @example
 * // 基本使用方法
 * import { calculateEmotionState, getEmojiForEmotion } from '../utils/emotionUtils';
 *
 * // 计算情感状态
 * const emotion = calculateEmotionState({
 *   angerLevel: 3,
 *   trustLevel: 8,
 *   progressLevel: 6
 * });
 *
 * // 获取表情
 * const emoji = getEmojiForEmotion(emotion);
 */

import { EmotionState, EmotionCalculationParams } from "../types/index";

// ---------------------------------------------------------------------------
// 常量定义
// ---------------------------------------------------------------------------

/**
 * 情感状态与表情的默认映射
 *
 * 定义各情感状态对应的默认表情。
 * 在未指定自定义表情时使用。
 *
 * @type {Record<EmotionState, string>}
 */
export const DEFAULT_EMOTION_EMOJI_MAP: Record<EmotionState, string> = {
  angry: "😡",
  annoyed: "😒",
  neutral: "😐",
  satisfied: "🙂",
  happy: "😄",
};

/**
 * 情感状态说明文本用的 i18n 键映射（用于无障碍）
 *
 * 定义各情感状态对应的 i18n 键。
 * 用于向屏幕阅读器用户传达当前的情感状态。
 *
 * @type {Record<EmotionState, string>}
 */
export const EMOTION_DESCRIPTION_KEYS: Record<EmotionState, string> = {
  angry: "emotion.description.angry",
  annoyed: "emotion.description.annoyed",
  neutral: "emotion.description.neutral",
  satisfied: "emotion.description.satisfied",
  happy: "emotion.description.happy",
};

/**
 * 情感状态详细说明文本用的 i18n 键映射（用于无障碍）
 *
 * 定义各情感状态对应的详细说明 i18n 键。
 * 在屏幕阅读器用户请求详细信息时使用。
 *
 * @type {Record<EmotionState, string>}
 */
export const EMOTION_DETAILED_DESCRIPTION_KEYS: Record<EmotionState, string> = {
  angry: "emotion.detailedDescription.angry",
  annoyed: "emotion.detailedDescription.annoyed",
  neutral: "emotion.detailedDescription.neutral",
  satisfied: "emotion.detailedDescription.satisfied",
  happy: "emotion.detailedDescription.happy",
};



/**
 * 情感状态的无障碍颜色信息
 *
 * 考虑色觉障碍，确保足够对比度的颜色定义。
 * 为各情感状态定义浅色背景、深色背景、高对比度模式的颜色。
 * 确保符合 WCAG 2.1 AA 标准的对比度。
 *
 * @type {Record<EmotionState, { light: string; dark: string; highContrast: string }>}
 */
export const EMOTION_COLORS: Record<
  EmotionState,
  { light: string; dark: string; highContrast: string }
> = {
  angry: {
    light: "#d32f2f", // 红色 - 用于浅色背景
    dark: "#ff6659", // 红色的亮色版本 - 用于深色背景
    highContrast: "#ffffff", // 用于高对比度模式
  },
  annoyed: {
    light: "#ed6c02", // 琥珀色 - 用于浅色背景
    dark: "#ffac42", // 琥珀色的亮色版本 - 用于深色背景
    highContrast: "#ffffff", // 用于高对比度模式
  },
  neutral: {
    light: "#757575", // 灰色 - 用于浅色背景
    dark: "#a4a4a4", // 灰色的亮色版本 - 用于深色背景
    highContrast: "#ffffff", // 用于高对比度模式
  },
  satisfied: {
    light: "#2e7d32", // 绿色 - 用于浅色背景
    dark: "#60ad5e", // 绿色的亮色版本 - 用于深色背景
    highContrast: "#ffffff", // 用于高对比度模式
  },
  happy: {
    light: "#0288d1", // 蓝色 - 用于浅色背景
    dark: "#5eb8ff", // 蓝色的亮色版本 - 用于深色背景
    highContrast: "#ffffff", // 用于高对比度模式
  },
};

/** 情感状态计算的常量 */
const HYSTERESIS_THRESHOLD = 1.5; // 滞回（历史效应）的阈值
/** 怒气状态的阈值（因 arePropsEqual 也会使用而导出） */
export const ANGER_THRESHOLD = 7.5;
const ANGER_MULTIPLIER = 1.2; // 怒气得分的乘数

/** 得分计算用的阈值、权重常量（CR-004：魔术数字常量化） */
const ANNOYED_ANGER_THRESHOLD = 6; // 判定为不满状态的怒气水平阈值
/** 满意状态的阈值（因 arePropsEqual 也会使用而导出） */
export const SATISFIED_TRUST_THRESHOLD = 6;
/** 幸福状态的阈值（因 arePropsEqual 也会使用而导出） */
export const HAPPY_TRUST_THRESHOLD = 8;
const SATISFIED_PROGRESS_WEIGHT = 0.3; // 满意得分中进度的权重
const HAPPY_PROGRESS_WEIGHT = 0.5; // 幸福得分中进度的权重
const NEUTRAL_BASE_SCORE = 5; // 中立状态的基准得分

/** 自定义表情的最大字符数 */
const MAX_EMOJI_LENGTH = 10;

/** Unicode 控制字符、不可见字符的模式（防止 Bidi 攻击） */
const UNSAFE_UNICODE_PATTERN =
  /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/;

/**
 * 平分时的情感状态优先级（WR-004）
 *
 * 得分平分时，越靠近此数组开头的感情状态越优先。
 * 通过优先怒气类情感，避免遗漏重要反馈。
 */
const EMOTION_PRIORITY: EmotionState[] = [
  "angry",
  "annoyed",
  "happy",
  "satisfied",
  "neutral",
];

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/**
 * 情感状态的得分计算结果（WR-008：改为 Record 类型）
 *
 * 保存各情感状态“强度”打分后的结果。
 */
type EmotionScores = Record<EmotionState, number>;

// ---------------------------------------------------------------------------
// 内部工具函数
// ---------------------------------------------------------------------------

/**
 * 将指标值限制在有效范围（0-10）内
 *
 * 当指定的指标值超出范围时，将其限制在有效范围内。
 * 未定义或为 null 时返回默认值（5）。
 *
 * @param {number} value - 指标值
 * @returns {number} - 限制在有效范围内的值
 */
const clampMetricValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    if (import.meta.env.DEV) {
      console.warn(
        `[emotionUtils] Invalid metric value: ${value}. Using default ${NEUTRAL_BASE_SCORE}.`,
      );
    }
    return NEUTRAL_BASE_SCORE;
  }
  return Math.max(0, Math.min(10, value));
};

/**
 * 计算情感状态的得分（CR-004：使用常量）
 *
 * @param {EmotionCalculationParams} params - 计算参数
 * @returns {EmotionScores} - 各情感状态的得分
 */
const calculateEmotionScores = (
  params: EmotionCalculationParams,
): EmotionScores => {
  // 将指标值限制在有效范围内
  const anger = clampMetricValue(params.angerLevel);
  const trust = clampMetricValue(params.trustLevel);
  const progress = clampMetricValue(params.progressLevel);

  // 计算各情感状态的得分
  return {
    angry: anger >= ANGER_THRESHOLD ? anger * ANGER_MULTIPLIER : 0, // 怒气较高时提高优先级
    annoyed: anger >= ANNOYED_ANGER_THRESHOLD ? anger : 0,
    neutral: NEUTRAL_BASE_SCORE, // 中立始终作为基准值存在
    satisfied:
      trust >= SATISFIED_TRUST_THRESHOLD
        ? trust + progress * SATISFIED_PROGRESS_WEIGHT
        : 0, // 也略微考虑进度
    happy:
      trust >= HAPPY_TRUST_THRESHOLD
        ? trust + progress * HAPPY_PROGRESS_WEIGHT
        : 0, // 高信任度与高进度时最幸福
  };
};

/**
 * 获取得分最高的情感状态（WR-004：按优先级顺序遍历）
 *
 * 得分平分时，返回按 EMOTION_PRIORITY 顺序优先的情感状态。
 *
 * @param {EmotionScores} scores - 各情感状态的得分
 * @returns {EmotionState} - 得分最高的情感状态
 */
const getHighestEmotionState = (scores: EmotionScores): EmotionState => {
  let highestScore = -1;
  let highestEmotion: EmotionState = "neutral"; // 默认值

  // 按优先级顺序遍历，平分时选择靠前的情感状态
  for (const emotion of EMOTION_PRIORITY) {
    if (scores[emotion] > highestScore) {
      highestScore = scores[emotion];
      highestEmotion = emotion;
    }
  }

  return highestEmotion;
};

/**
 * 应用滞回确定情感状态（WR-001：浮点数边界修正）
 *
 * @param {EmotionState} newEmotion - 新计算出的情感状态
 * @param {EmotionState | undefined} previousEmotion - 上一次的情感状态
 * @param {EmotionScores} scores - 各情感状态的得分
 * @returns {EmotionState} - 应用滞回后的情感状态
 */
const applyHysteresis = (
  newEmotion: EmotionState,
  previousEmotion: EmotionState | undefined,
  scores: EmotionScores,
): EmotionState => {
  // 没有上一次情感状态时直接返回新情感状态
  if (!previousEmotion) return newEmotion;

  // 对 'angry' 状态的变化立即生效（因为反馈重要）
  // 怒气得分达到阈值以上时必定设为怒气状态（优先级最高）
  const ANGER_HYSTERESIS_OVERRIDE = ANGER_THRESHOLD * ANGER_MULTIPLIER;
  if (scores.angry >= ANGER_HYSTERESIS_OVERRIDE) return "angry";

  // 与上一次相同的情感状态时直接返回
  if (newEmotion === previousEmotion) return newEmotion;

  // 计算上一次与新的情感状态的得分差
  const previousScore = scores[previousEmotion] || 0;
  const newScore = scores[newEmotion] || 0;
  const scoreDifference = Math.abs(newScore - previousScore);

  // 仅当得分差达到滞回阈值以上时更改情感状态
  return scoreDifference >= HYSTERESIS_THRESHOLD ? newEmotion : previousEmotion;
};

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 根据指标计算情感状态
 *
 * 根据指定的指标（怒气、信任度、进度）计算合适的情感状态。
 * 应用滞回（历史效应），防止因微小变化导致状态频繁切换。
 *
 * @param {EmotionCalculationParams} params - 计算参数
 * @param {number} params.angerLevel - 怒气水平（0-10）
 * @param {number} params.trustLevel - 信任度水平（0-10）
 * @param {number} params.progressLevel - 进度水平（0-10）
 * @param {EmotionState} [params.previousEmotion] - 上一次的情感状态
 * @returns {EmotionState} - 计算出的情感状态
 */
export const calculateEmotionState = (
  params: EmotionCalculationParams,
): EmotionState => {
  try {
    // 计算情感状态的得分
    const scores = calculateEmotionScores(params);

    // 获取得分最高的情感状态
    const highestEmotion = getHighestEmotionState(scores);

    // 应用滞回确定最终的情感状态
    return applyHysteresis(highestEmotion, params.previousEmotion, scores);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[emotionUtils] Error during emotion state calculation:", error);
    }
    // WR-006：存在上一次的情感状态时将其作为兜底使用
    return params.previousEmotion ?? "neutral";
  }
};

/**
 * 获取情感状态对应的表情（WR-002/WR-003/SG-004）
 *
 * 返回指定情感状态对应的表情。
 * 指定了自定义表情映射时使用之，
 * 否则从默认的表情映射中获取。
 *
 * @param {EmotionState} emotion - 情感状态
 * @param {Record<EmotionState, string>} [customEmojis] - 自定义表情映射
 * @returns {string} - 情感状态对应的表情
 */
export const getEmojiForEmotion = (
  emotion: EmotionState,
  customEmojis?: Record<EmotionState, string>,
): string => {
  // 无效的情感状态时返回中立的表情
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_EMOTION_EMOJI_MAP, emotion)) {
    return DEFAULT_EMOTION_EMOJI_MAP.neutral;
  }

  // 提供了自定义表情时先验证再使用（多层防御）
  if (customEmojis && customEmojis[emotion]) {
    const value = customEmojis[emotion];
    if (
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= MAX_EMOJI_LENGTH &&
      !UNSAFE_UNICODE_PATTERN.test(value)
    ) {
      return value;
    }
    // 验证失败时回退到默认
    return DEFAULT_EMOTION_EMOJI_MAP[emotion];
  }

  // 从默认的表情映射中获取
  return DEFAULT_EMOTION_EMOJI_MAP[emotion];
};

/**
 * 验证自定义表情映射，并用默认表情补全缺失的情感状态
 *
 * 验证指定的自定义表情映射，若存在未定义的情感状态，
 * 返回用默认表情补全的完整映射。
 * 未指定自定义表情映射时，返回默认映射。
 * 对自定义值进行类型检查和长度检查，非法值用默认值补全。
 *
 * @param {Record<EmotionState, string>} [customEmojis] - 自定义表情映射
 * @returns {Record<EmotionState, string>} - 完整的表情映射
 */
export const validateAndCompleteEmojiMap = (
  customEmojis?: Record<EmotionState, string>,
): Record<EmotionState, string> => {
  if (!customEmojis) return DEFAULT_EMOTION_EMOJI_MAP;

  const completeMap = { ...DEFAULT_EMOTION_EMOJI_MAP };

  // 验证自定义表情映射的每个条目并覆盖默认映射
  (Object.keys(DEFAULT_EMOTION_EMOJI_MAP) as EmotionState[]).forEach(
    (emotion) => {
      const customValue = customEmojis[emotion];
      // 类型检查：必须是字符串、非空、在最大长度以内、不包含 Unicode 控制字符
      if (
        typeof customValue === "string" &&
        customValue.length > 0 &&
        customValue.length <= MAX_EMOJI_LENGTH &&
        !UNSAFE_UNICODE_PATTERN.test(customValue)
      ) {
        completeMap[emotion] = customValue;
      }
    },
  );

  return completeMap;
};

// ---------------------------------------------------------------------------
// 测试专用导出
// ---------------------------------------------------------------------------

/** @internal 测试专用导出（生产构建中排除） */
export const _testExports = import.meta.env.DEV
  ? {
    clampMetricValue,
    calculateEmotionScores,
    getHighestEmotionState,
    applyHysteresis,
  }
  : undefined;
