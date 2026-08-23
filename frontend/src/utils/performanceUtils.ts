/**
 * 性能工具
 *
 * 提供用于性能优化的辅助函数。
 * 提供渲染性能测量、防抖、节流、
 * 基于设备性能的优化等功能。
 *
 * @module performanceUtils
 * @author AI 销售角色扮演开发团队
 * @version 1.0.0
 * @example
 * // 获取性能信息
 * import { getPerformanceInfo } from '../utils/performanceUtils';
 *
 * const perfInfo = getPerformanceInfo();
 * if (perfInfo.isLowEndDevice) {
 *   // 针对低配设备执行优化
 * }
 */

/**
 * 测量渲染性能
 *
 * 测量组件的渲染时间并输出到控制台。
 * 仅在开发环境生效，生产环境不执行任何操作。
 *
 * @template T - 回调函数返回值的类型
 * @param {string} componentName - 组件名
 * @param {() => T} callback - 待测量的函数
 * @returns {T} - callback 函数的返回值
 *
 * @example
 * // 测量渲染时间
 * const result = measureRenderTime('MyComponent', () => {
 *   // 要测量的处理
 *   return someValue;
 * });
 */
export const measureRenderTime = <T>(
  componentName: string,
  callback: () => T,
): T => {
  // 生产环境不测量
  if (process.env.NODE_ENV === "production") {
    return callback();
  }

  console.time(`${componentName} render time`);
  const result = callback();
  console.timeEnd(`${componentName} render time`);
  return result;
};

/**
 * 防抖函数
 *
 * 在指定时间内被多次调用时，仅执行最后一次调用。
 * 用于高频事件的性能优化。
 *
 * @template T - 函数的类型
 * @param {T} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {(...args: Parameters<T>) => void} - 防抖后的函数
 *
 * @example
 * // 调整大小事件的防抖
 * const handleResize = debounce(() => {
 *   // 调整大小处理
 * }, 200);
 *
 * window.addEventListener('resize', handleResize);
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
};

/**
 * 节流函数
 *
 * 在指定时间内仅执行一次函数。
 * 用于滚动事件等高频率事件的性能优化。
 *
 * @template T - 函数的类型
 * @param {T} func - 要执行的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {(...args: Parameters<T>) => void} - 节流后的函数
 *
 * @example
 * // 滚动事件的节流
 * const handleScroll = throttle(() => {
 *   // 滚动处理
 * }, 100);
 *
 * window.addEventListener('scroll', handleScroll);
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number,
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

/**
 * 获取浏览器的性能信息
 *
 * 获取当前浏览器环境的性能信息。
 * 可用于移动设备检测或基于硬件性能的优化。
 *
 * @returns {Object} 性能信息对象
 * @returns {boolean} isMobile - 是否为移动设备
 * @returns {boolean} isLowEndDevice - 是否为低配设备
 * @returns {boolean} prefersReducedMotion - 用户是否希望减少动画
 * @returns {number} hardwareConcurrency - CPU 核心数
 * @returns {number|undefined} deviceMemory - 设备内存量（GB）
 * @returns {string} connectionType - 网络连接类型
 *
 * @example
 * const perfInfo = getPerformanceInfo();
 *
 * if (perfInfo.isLowEndDevice) {
 *   // 针对低配设备的优化
 * }
 *
 * if (perfInfo.prefersReducedMotion) {
 *   // 禁用或简化动画
 * }
 */
export const getPerformanceInfo = () => {
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  // deviceMemory 不是 Navigator 接口的标准属性，因此使用扩展接口
  interface NavigatorWithMemory extends Navigator {
    deviceMemory?: number;
  }
  const nav = navigator as NavigatorWithMemory;
  const deviceMemory = nav.deviceMemory;

  const isLowEndDevice =
    isMobile && deviceMemory !== undefined && deviceMemory < 4;

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 用于网络连接信息的接口
  interface NetworkInformation {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  }

  interface NavigatorWithConnection extends NavigatorWithMemory {
    connection?: NetworkInformation;
  }

  const navWithConnection = nav as NavigatorWithConnection;
  const connection = navWithConnection.connection;
  const connectionType = connection?.effectiveType;

  return {
    isMobile,
    isLowEndDevice,
    prefersReducedMotion,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    deviceMemory: deviceMemory,
    connectionType: connectionType || "unknown",
  };
};

/**
 * 根据设备性能优化动画
 *
 * 根据设备性能调整动画的复杂度。
 * 低配设备使用简易动画。
 * 此外，当 prefers-reduced-motion 设置生效时禁用动画。
 *
 * @param {string} defaultAnimation - 默认的动画设置
 * @returns {string} - 优化后的动画设置
 *
 * @example
 * // 动画的优化
 * const animation = optimizeAnimation('bounce 1s ease-in-out');
 *
 * // 应用于 CSS 样式
 * const styles = {
 *   animation: animation
 * };
 */
export const optimizeAnimation = (defaultAnimation: string): string => {
  const { isLowEndDevice, prefersReducedMotion } = getPerformanceInfo();

  if (prefersReducedMotion) {
    return "none";
  }

  if (isLowEndDevice) {
    // 低配设备使用简易动画
    if (defaultAnimation.includes("bounce")) {
      return "bounce 1.5s ease-in-out";
    }
    if (defaultAnimation.includes("shake")) {
      return "shake 1s ease-in-out";
    }
    if (defaultAnimation.includes("pulse")) {
      return "pulse 1.5s ease-in-out";
    }
  }

  return defaultAnimation;
};
