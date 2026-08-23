/**
 * 无障碍工具
 *
 * 提供无障碍相关的辅助函数与常量。
 * 用于确保符合 WCAG 2.1 AA 标准的无障碍性。
 *
 * @module accessibilityUtils
 * @author AI 销售角色扮演开发团队
 * @version 1.0.0
 * @example
 * // 获取焦点样式
 * import { getFocusStyles } from '../utils/accessibilityUtils';
 *
 * const styles = {
 *   '&:focus': getFocusStyles()
 * };
 */

/**
 * 无障碍颜色的定义
 *
 * 符合 WCAG 2.1 AA、具有足够对比度的颜色定义。
 * 对于浅色背景确保 4.5:1 以上的对比度。
 *
 * @type {Object}
 * @property {string} success - 表示成功状态的颜色（绿色）
 * @property {string} warning - 表示警告状态的颜色（琥珀色）
 * @property {string} error - 表示错误状态的颜色（红色）
 * @property {string} info - 表示信息状态的颜色（蓝色）
 * @property {string} primaryText - 主要文本颜色
 * @property {string} secondaryText - 次要文本颜色
 * @property {string} disabledText - 禁用文本颜色
 * @property {string} lightBackground - 浅色背景颜色
 * @property {string} focusOutline - 焦点轮廓颜色
 */
export const accessibleColors = {
  // 主要颜色
  success: "#2e7d32", // 绿色 - 成功状态
  warning: "#ed6c02", // 琥珀色 - 警告状态
  error: "#d32f2f", // 红色 - 错误状态
  info: "#0288d1", // 蓝色 - 信息状态

  // 文本颜色
  primaryText: "#1a1a1a", // 主要文本（对比度 14:1）
  secondaryText: "#616161", // 次要文本（对比度 7:1）
  disabledText: "#757575", // 禁用文本（对比度 4.6:1）

  // 背景颜色
  lightBackground: "#f5f5f5", // 浅色背景
  focusOutline: "#1976d2", // 焦点轮廓
};

/**
 * 根据指标值获取颜色
 *
 * 根据指定的指标值与类型，返回无障碍颜色。
 * 考虑色觉障碍，不仅使用颜色，还结合数值传达信息。
 *
 * @param {number} value - 指标值（1-10）
 * @param {'anger' | 'trust' | 'progress'} type - 指标类型
 * @returns {string} - 颜色代码（hex）
 *
 * @example
 * // 获取怒气计的颜色
 * const angerColor = getMetricsColor(8, 'anger'); // => '#d32f2f'
 *
 * // 获取信任度的颜色
 * const trustColor = getMetricsColor(9, 'trust'); // => '#2e7d32'
 */
export const getMetricsColor = (
  value: number,
  type: "anger" | "trust" | "progress",
): string => {
  // 怒气计则相反（越高越红）
  if (type === "anger") {
    if (value >= 8) return accessibleColors.error;
    if (value >= 5) return accessibleColors.warning;
    return accessibleColors.success;
  }
  // 信任度或进度的情况（越高越绿）
  else {
    if (value >= 8) return accessibleColors.success;
    if (value >= 5) return accessibleColors.info;
    return accessibleColors.error;
  }
};

/**
 * 根据指标值获取状态文本
 *
 * 根据指定的指标值与类型，返回表示状态的字符串。
 * 为屏幕阅读器用户补充视觉颜色信息。
 *
 * @param {number} value - 指标值（1-10）
 * @param {'anger' | 'trust' | 'progress'} type - 指标类型
 * @returns {string} - 表示状态的字符串
 *
 * @example
 * // 获取怒气计的状态文本
 * const angerStatus = getMetricsStatus(8, 'anger'); // => '非常高（危险）'
 *
 * // 获取信任度的状态文本
 * const trustStatus = getMetricsStatus(9, 'trust'); // => '非常高（良好）'
 */
export const getMetricsStatus = (
  value: number,
  type: "anger" | "trust" | "progress",
  t?: (key: string) => string,
): string => {
  // 提供了 t 函数时使用 i18n 键
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
  // 兜底：无 t 函数时使用英文文本
  if (type === "anger") {
    if (value >= 8) return "Very High (Danger)";
    if (value >= 5) return "Moderate (Caution)";
    return "Low (Good)";
  }
  // 信任度或进度的情况
  else {
    if (value >= 8) return "Very High (Good)";
    if (value >= 5) return "Moderate (Normal)";
    return "Low (Needs Improvement)";
  }
};

/**
 * 获取无障碍焦点样式
 *
 * 返回用于键盘焦点的视觉样式。
 * 将其应用于可聚焦元素，可提升键盘用户的可操作性。
 * 提供符合 WCAG 2.1 AA 标准、高可见性的焦点样式。
 *
 * @returns {Object} - 焦点样式的对象
 *
 * @example
 * // React 组件中的使用示例
 * const styles = {
 *   button: {
 *     // 常规样式
 *     padding: '8px 16px',
 *     backgroundColor: '#0288d1',
 *     color: '#ffffff',
 *     // 焦点时的样式
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
 * 获取动画设置
 *
 * 返回考虑无障碍性的动画设置。
 * 尊重 prefers-reduced-motion 设置，必要时减少动画。
 * 当用户在系统设置中选择减少动画时，
 * 自动禁用动画。
 *
 * @param {string} animationName - 动画名称
 * @param {number} duration - 动画时长（毫秒）
 * @returns {Object} - 动画设置的对象
 *
 * @example
 * // 无障碍淡入动画的设置
 * const fadeInAnimation = getAccessibleAnimation('fadeIn', 300);
 *
 * // 应用于 CSS 样式
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
