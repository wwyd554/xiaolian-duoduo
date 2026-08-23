/**
 * 视频录制设置的持久化工具
 *
 * 通过 localStorage 读写视频录制功能的开关设置。
 * 考虑 Safari 隐私模式或存储不可用环境下的异常，
 * 用 try-catch 保护所有访问。
 */

/** localStorage 的键名 */
const STORAGE_KEY = "videoRecordingEnabled";

/**
 * 视频录制设置的默认值（false = 录制关闭）
 * 由于本项目本地化后删除了视频分析后端，
 * 未设置时默认为录制关闭，以便不初始化摄像头即可开始对话。
 * 默认值的单一事实来源（Single Source of Truth）。
 */
export const DEFAULT_VIDEO_RECORDING_ENABLED = false;

/**
 * 从 localStorage 读取视频录制设置
 *
 * @returns 录制启用时返回 true。未设置或读取失败时返回默认值
 */
export function loadVideoRecordingEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // 未设置（null）时返回默认值（保持现有行为）
    if (saved === null) {
      return DEFAULT_VIDEO_RECORDING_ENABLED;
    }
    return saved === "true";
  } catch (error) {
    // 在无法使用 localStorage 的环境（隐私模式等）中回退到默认值
    console.warn(
      "视频录制设置加载失败，将使用默认值。 / Failed to load video recording setting, using default.",
      error,
    );
    return DEFAULT_VIDEO_RECORDING_ENABLED;
  }
}

/**
 * 将视频录制设置保存到 localStorage
 *
 * @param enabled 启用录制时为 true
 */
export function saveVideoRecordingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch (error) {
    // 保存失败时应用仍继续运行（只是设置不会持久化）
    console.warn(
      "视频录制设置保存失败。 / Failed to save video recording setting.",
      error,
    );
  }
}
