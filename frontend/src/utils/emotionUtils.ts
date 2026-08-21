/**
 * 感情状態計算ユーティリティ
 *
 * メトリクス（怒り、信頼度、進捗度）から感情状態を計算し、
 * 対応する絵文字を提供するためのユーティリティ関数群です。
 *
 * @module emotionUtils
 * @author AI営業ロールプレイ開発チーム
 * @version 2.0.0
 * @example
 * // 基本的な使用方法
 * import { calculateEmotionState, getEmojiForEmotion } from '../utils/emotionUtils';
 *
 * // 感情状態の計算
 * const emotion = calculateEmotionState({
 *   angerLevel: 3,
 *   trustLevel: 8,
 *   progressLevel: 6
 * });
 *
 * // 絵文字の取得
 * const emoji = getEmojiForEmotion(emotion);
 */

import { EmotionState, EmotionCalculationParams } from "../types/index";

// ---------------------------------------------------------------------------
// 定数定義
// ---------------------------------------------------------------------------

/**
 * 感情状態と絵文字のデフォルトマッピング
 *
 * 各感情状態に対応するデフォルトの絵文字を定義します。
 * カスタム絵文字が指定されていない場合に使用されます。
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
 * 感情状態の説明テキスト用i18nキーマッピング（アクセシビリティ用）
 *
 * 各感情状態に対応するi18nキーを定義します。
 * スクリーンリーダーユーザーに対して、現在の感情状態を伝えるために使用されます。
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
 * 感情状態の詳細な説明テキスト用i18nキーマッピング（アクセシビリティ用）
 *
 * 各感情状態に対応する詳細説明のi18nキーを定義します。
 * スクリーンリーダーユーザーが詳細情報を要求した場合に使用されます。
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
 * 感情状態のアクセシビリティ用色情報
 *
 * 色覚異常を考慮し、十分なコントラスト比を確保した色の定義です。
 * 各感情状態に対して、明るい背景用、暗い背景用、高コントラストモード用の色を定義します。
 * WCAG 2.1 AA基準に準拠したコントラスト比を確保しています。
 *
 * @type {Record<EmotionState, { light: string; dark: string; highContrast: string }>}
 */
export const EMOTION_COLORS: Record<
  EmotionState,
  { light: string; dark: string; highContrast: string }
> = {
  angry: {
    light: "#d32f2f", // 赤色 - 明るい背景用
    dark: "#ff6659", // 赤色の明るいバージョン - 暗い背景用
    highContrast: "#ffffff", // 高コントラストモード用
  },
  annoyed: {
    light: "#ed6c02", // 琥珀色 - 明るい背景用
    dark: "#ffac42", // 琥珀色の明るいバージョン - 暗い背景用
    highContrast: "#ffffff", // 高コントラストモード用
  },
  neutral: {
    light: "#757575", // 灰色 - 明るい背景用
    dark: "#a4a4a4", // 灰色の明るいバージョン - 暗い背景用
    highContrast: "#ffffff", // 高コントラストモード用
  },
  satisfied: {
    light: "#2e7d32", // 緑色 - 明るい背景用
    dark: "#60ad5e", // 緑色の明るいバージョン - 暗い背景用
    highContrast: "#ffffff", // 高コントラストモード用
  },
  happy: {
    light: "#0288d1", // 青色 - 明るい背景用
    dark: "#5eb8ff", // 青色の明るいバージョン - 暗い背景用
    highContrast: "#ffffff", // 高コントラストモード用
  },
};

/** 感情状態計算の定数 */
const HYSTERESIS_THRESHOLD = 1.5; // ヒステリシス（履歴効果）の閾値
/** 怒り状態の閾値（arePropsEqualでも使用するためエクスポート） */
export const ANGER_THRESHOLD = 7.5;
const ANGER_MULTIPLIER = 1.2; // 怒りスコアの乗数

/** スコア計算用の閾値・重み定数（CR-004: マジックナンバー定数化） */
const ANNOYED_ANGER_THRESHOLD = 6; // 不満状態と判定する怒りレベルの閾値
/** 満足状態の閾値（arePropsEqualでも使用するためエクスポート） */
export const SATISFIED_TRUST_THRESHOLD = 6;
/** 幸福状態の閾値（arePropsEqualでも使用するためエクスポート） */
export const HAPPY_TRUST_THRESHOLD = 8;
const SATISFIED_PROGRESS_WEIGHT = 0.3; // 満足スコアにおける進捗度の重み
const HAPPY_PROGRESS_WEIGHT = 0.5; // 幸福スコアにおける進捗度の重み
const NEUTRAL_BASE_SCORE = 5; // 中立状態の基準スコア

/** カスタム絵文字の最大文字数 */
const MAX_EMOJI_LENGTH = 10;

/** Unicode制御文字・不可視文字のパターン（Bidi攻撃防止） */
const UNSAFE_UNICODE_PATTERN =
  /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/;

/**
 * 同点時の感情状態優先度（WR-004）
 *
 * スコアが同点の場合、この配列の先頭に近い感情状態が優先されます。
 * 怒り系の感情を優先することで、重要なフィードバックを見逃さないようにします。
 */
const EMOTION_PRIORITY: EmotionState[] = [
  "angry",
  "annoyed",
  "happy",
  "satisfied",
  "neutral",
];

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/**
 * 感情状態のスコア計算結果（WR-008: Record型に変更）
 *
 * 各感情状態の「強さ」をスコア化した結果を保持します。
 */
type EmotionScores = Record<EmotionState, number>;

// ---------------------------------------------------------------------------
// 内部ユーティリティ関数
// ---------------------------------------------------------------------------

/**
 * メトリクス値を有効な範囲（0-10）に制限する
 *
 * 指定されたメトリクス値が範囲外の場合、有効な範囲内に制限します。
 * 未定義またはnullの場合はデフォルト値（5）を返します。
 *
 * @param {number} value - メトリクス値
 * @returns {number} - 有効範囲内に制限された値
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
 * 感情状態のスコアを計算する（CR-004: 定数を使用）
 *
 * @param {EmotionCalculationParams} params - 計算パラメータ
 * @returns {EmotionScores} - 各感情状態のスコア
 */
const calculateEmotionScores = (
  params: EmotionCalculationParams,
): EmotionScores => {
  // メトリクス値を有効範囲に制限
  const anger = clampMetricValue(params.angerLevel);
  const trust = clampMetricValue(params.trustLevel);
  const progress = clampMetricValue(params.progressLevel);

  // 各感情状態のスコア計算
  return {
    angry: anger >= ANGER_THRESHOLD ? anger * ANGER_MULTIPLIER : 0, // 怒りが高い場合、優先度を上げる
    annoyed: anger >= ANNOYED_ANGER_THRESHOLD ? anger : 0,
    neutral: NEUTRAL_BASE_SCORE, // 中立は常に基準値として存在
    satisfied:
      trust >= SATISFIED_TRUST_THRESHOLD
        ? trust + progress * SATISFIED_PROGRESS_WEIGHT
        : 0, // 進捗度も少し考慮
    happy:
      trust >= HAPPY_TRUST_THRESHOLD
        ? trust + progress * HAPPY_PROGRESS_WEIGHT
        : 0, // 高信頼度と高進捗度で最も幸せ
  };
};

/**
 * 最も高いスコアの感情状態を取得する（WR-004: 優先度順で走査）
 *
 * スコアが同点の場合、EMOTION_PRIORITY の順序で優先される感情状態を返します。
 *
 * @param {EmotionScores} scores - 各感情状態のスコア
 * @returns {EmotionState} - 最も高いスコアの感情状態
 */
const getHighestEmotionState = (scores: EmotionScores): EmotionState => {
  let highestScore = -1;
  let highestEmotion: EmotionState = "neutral"; // デフォルト値

  // 優先度順に走査することで、同点時は先頭の感情状態が選ばれる
  for (const emotion of EMOTION_PRIORITY) {
    if (scores[emotion] > highestScore) {
      highestScore = scores[emotion];
      highestEmotion = emotion;
    }
  }

  return highestEmotion;
};

/**
 * ヒステリシスを適用して感情状態を決定する（WR-001: 浮動小数点マージン修正）
 *
 * @param {EmotionState} newEmotion - 新しく計算された感情状態
 * @param {EmotionState | undefined} previousEmotion - 前回の感情状態
 * @param {EmotionScores} scores - 各感情状態のスコア
 * @returns {EmotionState} - ヒステリシス適用後の感情状態
 */
const applyHysteresis = (
  newEmotion: EmotionState,
  previousEmotion: EmotionState | undefined,
  scores: EmotionScores,
): EmotionState => {
  // 前回の感情状態がない場合は新しい感情状態をそのまま返す
  if (!previousEmotion) return newEmotion;

  // 'angry'状態への変化は即時に反映（重要なフィードバックのため）
  // 怒りスコアが閾値以上の場合は必ず怒り状態にする（優先度最高）
  const ANGER_HYSTERESIS_OVERRIDE = ANGER_THRESHOLD * ANGER_MULTIPLIER;
  if (scores.angry >= ANGER_HYSTERESIS_OVERRIDE) return "angry";

  // 前回と同じ感情状態の場合はそのまま返す
  if (newEmotion === previousEmotion) return newEmotion;

  // 前回の感情状態と新しい感情状態のスコア差を計算
  const previousScore = scores[previousEmotion] || 0;
  const newScore = scores[newEmotion] || 0;
  const scoreDifference = Math.abs(newScore - previousScore);

  // スコア差がヒステリシス閾値以上の場合のみ感情状態を変更
  return scoreDifference >= HYSTERESIS_THRESHOLD ? newEmotion : previousEmotion;
};

// ---------------------------------------------------------------------------
// 公開API
// ---------------------------------------------------------------------------

/**
 * メトリクスから感情状態を計算する
 *
 * 指定されたメトリクス（怒り、信頼度、進捗度）から適切な感情状態を計算します。
 * ヒステリシス（履歴効果）を適用して、微小な変化による頻繁な状態変化を防止します。
 *
 * @param {EmotionCalculationParams} params - 計算パラメータ
 * @param {number} params.angerLevel - 怒りレベル (0-10)
 * @param {number} params.trustLevel - 信頼度レベル (0-10)
 * @param {number} params.progressLevel - 進捗度レベル (0-10)
 * @param {EmotionState} [params.previousEmotion] - 前回の感情状態
 * @returns {EmotionState} - 計算された感情状態
 */
export const calculateEmotionState = (
  params: EmotionCalculationParams,
): EmotionState => {
  try {
    // 感情状態のスコアを計算
    const scores = calculateEmotionScores(params);

    // 最も高いスコアの感情状態を取得
    const highestEmotion = getHighestEmotionState(scores);

    // ヒステリシスを適用して最終的な感情状態を決定
    return applyHysteresis(highestEmotion, params.previousEmotion, scores);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[emotionUtils] Error during emotion state calculation:", error);
    }
    // WR-006: 前回の感情状態があればそれをフォールバックとして使用
    return params.previousEmotion ?? "neutral";
  }
};

/**
 * 感情状態に対応する絵文字を取得する（WR-002/WR-003/SG-004）
 *
 * 指定された感情状態に対応する絵文字を返します。
 * カスタム絵文字マップが指定されている場合はそれを使用し、
 * そうでない場合はデフォルトの絵文字マッピングから取得します。
 *
 * @param {EmotionState} emotion - 感情状態
 * @param {Record<EmotionState, string>} [customEmojis] - カスタム絵文字マップ
 * @returns {string} - 感情状態に対応する絵文字
 */
export const getEmojiForEmotion = (
  emotion: EmotionState,
  customEmojis?: Record<EmotionState, string>,
): string => {
  // 無効な感情状態の場合は中立の絵文字を返す
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_EMOTION_EMOJI_MAP, emotion)) {
    return DEFAULT_EMOTION_EMOJI_MAP.neutral;
  }

  // カスタム絵文字が提供されている場合は検証してから使用（多層防御）
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
    // 検証失敗時はデフォルトにフォールバック
    return DEFAULT_EMOTION_EMOJI_MAP[emotion];
  }

  // デフォルトの絵文字マッピングから取得
  return DEFAULT_EMOTION_EMOJI_MAP[emotion];
};

/**
 * カスタム絵文字マップを検証し、不足している感情状態をデフォルトで補完する
 *
 * 指定されたカスタム絵文字マップを検証し、定義されていない感情状態があれば
 * デフォルトの絵文字で補完した完全なマップを返します。
 * カスタム絵文字マップが指定されていない場合は、デフォルトのマップを返します。
 * カスタム値は型チェックと長さチェックを行い、不正な値はデフォルトで補完します。
 *
 * @param {Record<EmotionState, string>} [customEmojis] - カスタム絵文字マップ
 * @returns {Record<EmotionState, string>} - 完全な絵文字マップ
 */
export const validateAndCompleteEmojiMap = (
  customEmojis?: Record<EmotionState, string>,
): Record<EmotionState, string> => {
  if (!customEmojis) return DEFAULT_EMOTION_EMOJI_MAP;

  const completeMap = { ...DEFAULT_EMOTION_EMOJI_MAP };

  // カスタム絵文字マップの各エントリを検証してデフォルトマップに上書き
  (Object.keys(DEFAULT_EMOTION_EMOJI_MAP) as EmotionState[]).forEach(
    (emotion) => {
      const customValue = customEmojis[emotion];
      // 型チェック: 文字列であること、空でないこと、最大長以内であること、Unicode制御文字を含まないこと
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
// テスト専用エクスポート
// ---------------------------------------------------------------------------

/** @internal テスト専用エクスポート（本番ビルドでは除外） */
export const _testExports = import.meta.env.DEV
  ? {
    clampMetricValue,
    calculateEmotionScores,
    getHighestEmotionState,
    applyHysteresis,
  }
  : undefined;
