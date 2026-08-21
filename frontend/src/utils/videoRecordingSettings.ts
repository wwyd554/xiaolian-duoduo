/**
 * ビデオ録画設定の永続化ユーティリティ
 *
 * localStorageを介してビデオ録画機能のオン/オフ設定を読み書きする。
 * Safariプライベートモードやストレージ無効環境での例外を考慮し、
 * すべてのアクセスをtry-catchで保護する。
 */

/** localStorageのキー名 */
const STORAGE_KEY = "videoRecordingEnabled";

/**
 * ビデオ録画設定のデフォルト値（false = 録画オフ）
 * 本プロジェクトはローカル化に伴いビデオ分析バックエンドを削除したため、
 * 未設定時は録画オフとし、カメラ初期化なしで会話を開始できるようにする。
 * デフォルト値の単一の真実の源（Single Source of Truth）。
 */
export const DEFAULT_VIDEO_RECORDING_ENABLED = false;

/**
 * ビデオ録画設定をlocalStorageから読み込む
 *
 * @returns 録画が有効な場合はtrue。未設定または読み込み失敗時はデフォルト値
 */
export function loadVideoRecordingEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // 未設定（null）の場合はデフォルト値を返す（既存動作を維持）
    if (saved === null) {
      return DEFAULT_VIDEO_RECORDING_ENABLED;
    }
    return saved === "true";
  } catch (error) {
    // localStorageが利用できない環境（プライベートモード等）ではデフォルト値にフォールバック
    console.warn(
      "视频录制设置加载失败，将使用默认值。 / Failed to load video recording setting, using default.",
      error,
    );
    return DEFAULT_VIDEO_RECORDING_ENABLED;
  }
}

/**
 * ビデオ録画設定をlocalStorageに保存する
 *
 * @param enabled 録画を有効にする場合はtrue
 */
export function saveVideoRecordingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch (error) {
    // 保存失敗時もアプリの動作は継続する（設定が永続化されないだけ）
    console.warn(
      "视频录制设置保存失败。 / Failed to save video recording setting.",
      error,
    );
  }
}
