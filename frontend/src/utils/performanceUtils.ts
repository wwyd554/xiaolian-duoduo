/**
 * パフォーマンスユーティリティ
 *
 * パフォーマンス最適化のためのヘルパー関数を提供します。
 * レンダリングパフォーマンスの測定、デバウンス、スロットル、
 * デバイス性能に基づいた最適化などの機能を提供します。
 *
 * @module performanceUtils
 * @author AI営業ロールプレイ開発チーム
 * @version 1.0.0
 * @example
 * // パフォーマンス情報の取得
 * import { getPerformanceInfo } from '../utils/performanceUtils';
 *
 * const perfInfo = getPerformanceInfo();
 * if (perfInfo.isLowEndDevice) {
 *   // 低スペックデバイス向けの最適化を実行
 * }
 */

/**
 * レンダリングパフォーマンスを測定する
 *
 * コンポーネントのレンダリング時間を測定し、コンソールに出力します。
 * 開発環境でのみ動作し、本番環境では何もしません。
 *
 * @template T - コールバック関数の戻り値の型
 * @param {string} componentName - コンポーネント名
 * @param {() => T} callback - 測定対象の関数
 * @returns {T} - callback関数の戻り値
 *
 * @example
 * // レンダリング時間の測定
 * const result = measureRenderTime('MyComponent', () => {
 *   // 測定したい処理
 *   return someValue;
 * });
 */
export const measureRenderTime = <T>(
  componentName: string,
  callback: () => T,
): T => {
  // 本番環境では測定しない
  if (process.env.NODE_ENV === "production") {
    return callback();
  }

  console.time(`${componentName} render time`);
  const result = callback();
  console.timeEnd(`${componentName} render time`);
  return result;
};

/**
 * デバウンス関数
 *
 * 指定された時間内に複数回呼び出された場合、最後の呼び出しのみを実行します。
 * 高頻度で発生するイベントのパフォーマンス最適化に使用します。
 *
 * @template T - 関数の型
 * @param {T} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {(...args: Parameters<T>) => void} - デバウンスされた関数
 *
 * @example
 * // リサイズイベントのデバウンス
 * const handleResize = debounce(() => {
 *   // リサイズ処理
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
 * スロットル関数
 *
 * 指定された時間内に一度だけ関数を実行します。
 * スクロールイベントなどの高頻度イベントのパフォーマンス最適化に使用します。
 *
 * @template T - 関数の型
 * @param {T} func - 実行する関数
 * @param {number} limit - 制限時間（ミリ秒）
 * @returns {(...args: Parameters<T>) => void} - スロットルされた関数
 *
 * @example
 * // スクロールイベントのスロットル
 * const handleScroll = throttle(() => {
 *   // スクロール処理
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
 * ブラウザのパフォーマンス情報を取得する
 *
 * 現在のブラウザ環境のパフォーマンス情報を取得します。
 * モバイルデバイスの検出やハードウェアの性能に基づいた最適化に使用できます。
 *
 * @returns {Object} パフォーマンス情報オブジェクト
 * @returns {boolean} isMobile - モバイルデバイスかどうか
 * @returns {boolean} isLowEndDevice - 低スペックデバイスかどうか
 * @returns {boolean} prefersReducedMotion - ユーザーがアニメーションの削減を希望しているか
 * @returns {number} hardwareConcurrency - CPUコア数
 * @returns {number|undefined} deviceMemory - デバイスのメモリ量（GB）
 * @returns {string} connectionType - ネットワーク接続タイプ
 *
 * @example
 * const perfInfo = getPerformanceInfo();
 *
 * if (perfInfo.isLowEndDevice) {
 *   // 低スペックデバイス向けの最適化
 * }
 *
 * if (perfInfo.prefersReducedMotion) {
 *   // アニメーションを無効化または簡素化
 * }
 */
export const getPerformanceInfo = () => {
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  // deviceMemoryはNavigatorインターフェースの標準プロパティではないため、拡張インターフェースを使用
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

  // ネットワーク接続情報のためのインターフェース
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
 * デバイス性能に基づいてアニメーションを最適化する
 *
 * デバイスの性能に基づいて、アニメーションの複雑さを調整します。
 * 低スペックデバイスでは簡易的なアニメーションを使用します。
 * また、prefers-reduced-motionの設定が有効な場合はアニメーションを無効化します。
 *
 * @param {string} defaultAnimation - デフォルトのアニメーション設定
 * @returns {string} - 最適化されたアニメーション設定
 *
 * @example
 * // アニメーションの最適化
 * const animation = optimizeAnimation('bounce 1s ease-in-out');
 *
 * // CSSスタイルに適用
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
    // 低スペックデバイスでは簡易的なアニメーションを使用
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
