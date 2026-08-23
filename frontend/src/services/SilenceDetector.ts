/**
 * 静音检测处理类
 * 
 * 检测语音流中的静音区间，当静音持续超过一定时间时
 * 触发事件的辅助类。
 * 在 Amazon Transcribe 流式集成中，用于自动检测发言结束。
 */

export interface SilenceDetectorOptions {
  /** 静音判定阈值（0.0-1.0）- 默认值：0.05 */
  threshold?: number;
  
  /** 判定为静音前的时间（毫秒）- 默认值：1500ms */
  timeoutMs?: number;
}

export class SilenceDetector {
  private readonly threshold: number;
  private readonly timeoutMs: number;
  private lastSoundTimestamp: number = Date.now();
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private onSilenceDetectedCallback: (() => void) | null = null;
  private isActive: boolean = false;
  
  /**
   * 构造函数
   * @param options 配置选项
   */
  constructor(options?: SilenceDetectorOptions) {
    this.threshold = options?.threshold ?? 0.05;
    this.timeoutMs = options?.timeoutMs ?? 1500;
  }
  
  /**
   * 开始静音检测处理
   * @param onSilenceDetected 静音检测时的回调函数
   */
  public start(onSilenceDetected: () => void): void {
    this.onSilenceDetectedCallback = onSilenceDetected;
    this.isActive = true;
    this.lastSoundTimestamp = Date.now();
    this.resetTimer();
  }
  
  /**
   * 停止静音检测处理
   */
  public stop(): void {
    this.isActive = false;
    this.clearTimer();
    this.onSilenceDetectedCallback = null;
  }
  
  /**
   * 处理音量电平，低于阈值时判定为静音
   * @param soundLevel 音量电平（0.0-1.0）
   */
  public processSoundLevel(soundLevel: number): void {
    if (!this.isActive) return;
    
    if (soundLevel > this.threshold) {
      // 检测到语音
      this.lastSoundTimestamp = Date.now();
      this.resetTimer();
    }
  }
  
  /**
   * 重置静音定时器
   */
  public resetTimer(): void {
    this.clearTimer();
    
    this.silenceTimer = setTimeout(() => {
      const silenceTime = Date.now() - this.lastSoundTimestamp;
      if (silenceTime >= this.timeoutMs && this.isActive && this.onSilenceDetectedCallback) {
        console.log(`${silenceTime}ms间的静音已检测`);
        this.onSilenceDetectedCallback();
      }
    }, this.timeoutMs);
  }
  
  /**
   * 清除定时器
   */
  private clearTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}