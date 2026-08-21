/**
 * アクセシビリティユーティリティ
 *
 * アクセシビリティ関連のヘルパー関数と定数を提供します。
 * WCAG 2.1 AA基準に準拠したアクセシビリティを確保するために使用します。
 *
 * @module accessibilityUtils
 * @author AI営業ロールプレイ開発チーム
 * @version 1.0.0
 * @example
 * // フォーカススタイルの取得
 * import { getFocusStyles } from '../utils/accessibilityUtils';
 *
 * const styles = {
 *   '&:focus': getFocusStyles()
 * };
 */

/**
 * アクセシブルな色の定義
 *
 * WCAG 2.1 AAに準拠した、十分なコントラスト比を持つ色の定義です。
 * 明るい背景に対して4.5:1以上のコントラスト比を確保しています。
 *
 * @type {Object}
 * @property {string} success - 成功状態を表す色（緑色）
 * @property {string} warning - 警告状態を表す色（琥珀色）
 * @property {string} error - エラー状態を表す色（赤色）
 * @property {string} info - 情報状態を表す色（青色）
 * @property {string} primaryText - 主要テキスト色
 * @property {string} secondaryText - 副次テキスト色
 * @property {string} disabledText - 無効テキスト色
 * @property {string} lightBackground - 明るい背景色
 * @property {string} focusOutline - フォーカスアウトライン色
 */
export const accessibleColors = {
  // 主要な色
  success: "#2e7d32", // 緑色 - 成功状態
  warning: "#ed6c02", // 琥珀色 - 警告状態
  error: "#d32f2f", // 赤色 - エラー状態
  info: "#0288d1", // 青色 - 情報状態

  // テキスト色
  primaryText: "#1a1a1a", // 主要テキスト (コントラスト比 14:1)
  secondaryText: "#616161", // 副次テキスト (コントラスト比 7:1)
  disabledText: "#757575", // 無効テキスト (コントラスト比 4.6:1)

  // 背景色
  lightBackground: "#f5f5f5", // 明るい背景
  focusOutline: "#1976d2", // フォーカスアウトライン
};

/**
 * メトリクス値に基づいて色を取得する
 *
 * 指定されたメトリクス値と種類に基づいて、アクセシブルな色を返します。
 * 色覚異常を考慮し、色だけでなく値も併用して情報を伝えます。
 *
 * @param {number} value - メトリクス値 (1-10)
 * @param {'anger' | 'trust' | 'progress'} type - メトリクスの種類
 * @returns {string} - 色コード (hex)
 *
 * @example
 * // 怒りメーターの色を取得
 * const angerColor = getMetricsColor(8, 'anger'); // => '#d32f2f'
 *
 * // 信頼度の色を取得
 * const trustColor = getMetricsColor(9, 'trust'); // => '#2e7d32'
 */
export const getMetricsColor = (
  value: number,
  type: "anger" | "trust" | "progress",
): string => {
  // 怒りメーターの場合は逆になる（高いほど赤）
  if (type === "anger") {
    if (value >= 8) return accessibleColors.error;
    if (value >= 5) return accessibleColors.warning;
    return accessibleColors.success;
  }
  // 信頼度や進捗度の場合（高いほど緑）
  else {
    if (value >= 8) return accessibleColors.success;
    if (value >= 5) return accessibleColors.info;
    return accessibleColors.error;
  }
};

/**
 * メトリクス値に基づいて状態テキストを取得する
 *
 * 指定されたメトリクス値と種類に基づいて、状態を表す文字列を返します。
 * スクリーンリーダーのユーザーに対して、視覚的な色の情報を補完します。
 *
 * @param {number} value - メトリクス値 (1-10)
 * @param {'anger' | 'trust' | 'progress'} type - メトリクスの種類
 * @returns {string} - 状態を表す文字列
 *
 * @example
 * // 怒りメーターの状態テキストを取得
 * const angerStatus = getMetricsStatus(8, 'anger'); // => '非常に高い（危険）'
 *
 * // 信頼度の状態テキストを取得
 * const trustStatus = getMetricsStatus(9, 'trust'); // => '非常に高い（良好）'
 */
export const getMetricsStatus = (
  value: number,
  type: "anger" | "trust" | "progress",
  t?: (key: string) => string,
): string => {
  // t関数が提供されている場合はi18nキーを使用
  if (t) {
    if (type === "anger") {
      if (value >= 8) return t("metrics.status.anger.veryHigh");
      if (value >= 5) return t("metrics.status.anger.moderate");
      return t("metrics.status.anger.low");
    } else {
      if (value >= 8) return t("metrics.status.positive.veryHigh");
      if (value >= 5) return t("metrics.status.positive.moderate");
      return t("metrics.status.positive.low");
    }
  }
  // フォールバック: t関数なしの場合は英語テキスト
  if (type === "anger") {
    if (value >= 8) return "Very High (Danger)";
    if (value >= 5) return "Moderate (Caution)";
    return "Low (Good)";
  }
  // 信頼度や進捗度の場合
  else {
    if (value >= 8) return "Very High (Good)";
    if (value >= 5) return "Moderate (Normal)";
    return "Low (Needs Improvement)";
  }
};

/**
 * アクセシブルなフォーカススタイルを取得する
 *
 * キーボードフォーカスのための視覚的なスタイルを返します。
 * フォーカス可能な要素に適用することで、キーボードユーザーの操作性を向上させます。
 * WCAG 2.1 AA基準に準拠した、視認性の高いフォーカススタイルを提供します。
 *
 * @returns {Object} - フォーカススタイルのオブジェクト
 *
 * @example
 * // Reactコンポーネントでの使用例
 * const styles = {
 *   button: {
 *     // 通常のスタイル
 *     padding: '8px 16px',
 *     backgroundColor: '#0288d1',
 *     color: '#ffffff',
 *     // フォーカス時のスタイル
 *     '&:focus': getFocusStyles()
 *   }
 * };
 */
export const getFocusStyles = () => ({
  outline: "2px solid",
  outlineColor: accessibleColors.focusOutline,
  outlineOffset: "2px",
  borderRadius: "4px",
});

/**
 * アニメーション設定を取得する
 *
 * アクセシビリティに配慮したアニメーション設定を返します。
 * prefers-reduced-motionの設定を尊重し、必要に応じてアニメーションを削減します。
 * ユーザーがシステム設定でアニメーションの削減を選択している場合、
 * 自動的にアニメーションを無効化します。
 *
 * @param {string} animationName - アニメーション名
 * @param {number} duration - アニメーション時間（ミリ秒）
 * @returns {Object} - アニメーション設定のオブジェクト
 *
 * @example
 * // アクセシブルなフェードインアニメーションの設定
 * const fadeInAnimation = getAccessibleAnimation('fadeIn', 300);
 *
 * // CSSスタイルに適用
 * const styles = {
 *   ...fadeInAnimation
 * };
 */
export const getAccessibleAnimation = (
  animationName: string,
  duration: number,
) => ({
  animation: `${animationName} ${duration}ms`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});
