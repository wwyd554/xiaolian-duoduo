import { PollyService } from "./PollyService";

/**
 * 语音播放服务
 *
 * 负责文本语音合成与播放队列管理的服务类。
 * 通过与 Amazon Polly 集成，将文本转换为高质量语音，
 * 在浏览器中播放。提供控制播放顺序的队列功能以及将多个音频块
 * 连续播放的功能。
 *
 * 主要功能：
 * - 将文本转换为语音并播放（使用 Amazon Polly）
 * - 管理语音播放队列
 * - 语音启用/禁用切换
 * - 音量调节
 * - 长文本的分割与顺序处理
 * - 按消息 ID 管理关联语音
 */
export class AudioService {
  private static instance: AudioService;
  private audioQueue: Array<{
    id: string;
    audio: HTMLAudioElement;
    text: string;
    visemes?: Array<{ time: number; type: string; value: string }>;
  }> = [];
  private isPlaying: boolean = false;
  private audioEnabled: boolean = true;
  private audioVolume: number = 1.0;
  private currentSynthesisTasks: Map<string, AbortController> = new Map();
  private pollyService: PollyService;

  // 注册事件监听器
  private playbackCompleteListeners: Map<string, Set<() => void>> = new Map();
  private globalPlaybackListeners: Set<(messageId: string) => void> = new Set();

  /**
   * 构造函数 - 单例模式
   *
   * 初始化 AudioService 实例。获取 PollyService 实例，
   * 并准备语音合成功能。
   *
   * @private
   */
  private constructor() {
    this.pollyService = PollyService.getInstance();
  }

  /**
   * 获取单例实例
   *
   * 返回 AudioService 的唯一实例。若实例尚未
   * 创建，则新建一个。
   *
   * @returns {AudioService} AudioService 的单例实例
   */
  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * 启用/禁用语音
   *
   * 设置语音输出的启用/禁用状态。设为禁用时，当前正在播放的
   * 所有语音都会停止，新的语音合成请求将不被处理。
   *
   * @param {boolean} enabled 启用时为 true，禁用时为 false
   */
  public setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;

    if (!enabled) {
      this.stopAllAudio();
    }
  }

  /**
   * 设置音量
   *
   * 设置语音播放的音量级别。指定值将被限制在 0.0～1.0 范围内，
   * 当前队列中的语音也会立即应用音量变更。
   *
   * @param {number} volume 音量（0.0-1.0 范围，0.0 为静音，1.0 为最大音量）
   */
  public setVolume(volume: number): void {
    this.audioVolume = Math.max(0, Math.min(1, volume));

    // 若有正在播放的语音则应用音量
    this.audioQueue.forEach((item) => {
      item.audio.volume = this.audioVolume;
    });
  }

  /**
   * 将文本转换为语音并加入播放队列
   *
   * 使用 Amazon Polly 将文本转换为语音并加入播放队列。
   * 文本会被分割为合适的块大小，各块按顺序处理。
   * 若存在相同消息 ID 的现有合成任务，则将其取消并
   * 开始新任务。
   *
   * @param {string} text 要转换为语音的文本
   * @param {string} messageId 消息 ID（用于对多个语音块分组）
   * @param {string} [voiceId] 语音模型 ID（从场景的 NPC 设置中获取）
   * @returns {Promise<void>} 表示处理完成的 Promise
   */
  public async synthesizeAndQueueAudio(
    text: string,
    messageId: string,
    voiceId?: string,
  ): Promise<void> {
    if (!this.audioEnabled || !text) {
      return;
    }

    try {
      // 取消现有任务（相同消息 ID）
      if (this.currentSynthesisTasks.has(messageId)) {
        this.currentSynthesisTasks.get(messageId)?.abort();
        this.currentSynthesisTasks.delete(messageId);
      }

      // 文本分割（过长可能触发 Polly 的限制）
      const textChunks = this.splitTextIntoChunks(text, 1000);

      for (const chunk of textChunks) {
        // 创建新的 AbortController
        const controller = new AbortController();
        this.currentSynthesisTasks.set(messageId, controller);

        // 用 Amazon Polly 将文本转换为语音（同时获取 viseme 数据）
        // WR-007：未指定 voiceId 时回退到按语言选择的默认值
        const effectiveVoiceId = voiceId || 'Takumi';
        const result = await this.pollyService.synthesizeSpeechWithViseme(chunk, effectiveVoiceId);

        // 仅当任务未被取消时继续
        if (!controller.signal.aborted) {
          // 将语音加入队列（同时保留 viseme 数据）
          const audio = new Audio(result.audioUrl);
          audio.volume = this.audioVolume;

          this.audioQueue.push({
            id: messageId,
            audio,
            text: chunk,
            visemes: result.visemes && result.visemes.length > 0 ? result.visemes : undefined,
          });

          // 若未在播放则开始播放
          if (!this.isPlaying) {
            this.playNextAudio();
          }
        }
      }
    } catch (error) {
      console.error("语音合成错误:", error);
    } finally {
      // 任务完成后从 Map 中删除
      this.currentSynthesisTasks.delete(messageId);
    }
  }

  /**
   * 将文本分割为合适的块大小
   *
   * 考虑句子的边界，将长文本分割为合适大小的块。
   * 尽可能在自然的分界处（如标点符号）分割文本，
   * 使其不超过块大小上限。这样，
   * 可在 Polly 的限制内实现自然的语音合成。
   *
   * @param {string} text 要分割的文本
   * @param {number} chunkSize 块的最大大小（字符数）
   * @returns {string[]} 分割后的文本数组
   * @private
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      // 查找块大小或句子的结束位置
      let end = start + chunkSize;
      if (end >= text.length) {
        end = text.length;
      } else {
        // 查找句子分界（。、!?）
        const sentenceBreaks = [
          text.lastIndexOf("。", end),
          text.lastIndexOf("、", end),
          text.lastIndexOf("!", end),
          text.lastIndexOf("?", end),
          text.lastIndexOf("？", end),
          text.lastIndexOf("！", end),
        ].filter((pos) => pos > start && pos < end);

        // 若有句子分界则在此处分割
        if (sentenceBreaks.length > 0) {
          end = Math.max(...sentenceBreaks) + 1;
        }
      }

      chunks.push(text.substring(start, end));
      start = end;
    }

    return chunks;
  }

  /**
   * 将 Base64 编码的音频数据加入播放队列
   *
   * 将已经合成的音频数据（Base64 编码或 URL）加入播放队列。
   * 此方法跳过语音合成，直接使用提供的音频数据。
   * 若播放队列为空，则添加后立即开始播放。
   *
   * @param {string} audioData Base64 编码的音频数据或音频 URL
   * @param {string} text 音频的文本内容（用于调试和日志记录）
   * @param {string} messageId 消息 ID（用于对多个语音块分组）
   */
  public queueAudio(audioData: string, text: string, messageId: string): void {
    if (!this.audioEnabled) {
      return;
    }

    try {
      const audio = new Audio(audioData);
      audio.volume = this.audioVolume;

      // 加入队列
      this.audioQueue.push({
        id: messageId,
        audio,
        text,
      });

      // 若未在播放则开始播放
      if (!this.isPlaying) {
        this.playNextAudio();
      }
    } catch (error) {
      console.error("语音队列添加错误:", error);
    }
  }

  /**
   * 播放队列中的下一条语音
   *
   * 播放语音队列顶部的语音。当语音播放结束或
   * 发生错误时，会从队列中删除并尝试播放下一条语音。
   * 若语音被禁用或队列为空，则不播放任何内容。
   *
   * @private
   */
  private playNextAudio(): void {
    if (!this.audioEnabled || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const nextAudio = this.audioQueue[0];

    nextAudio.audio.onended = () => {
      // 播放结束后播放下一条语音
      const completedMessageId = nextAudio.id;
      this.audioQueue.shift();

      // 队列为空时（该消息播放完成），通知监听器
      if (this.audioQueue.length === 0 || this.audioQueue[0].id !== completedMessageId) {
        // 执行针对特定消息的监听器
        const listeners = this.playbackCompleteListeners.get(completedMessageId);
        if (listeners) {
          listeners.forEach(listener => listener());
        }

        // 执行全局监听器
        this.globalPlaybackListeners.forEach(listener => listener(completedMessageId));

        // 删除监听器（一次性事件）
        this.playbackCompleteListeners.delete(completedMessageId);
      }

      this.playNextAudio();
    };

    nextAudio.audio.onerror = (error) => {
      console.error("语音播放错误:", error);
      const errorMessageId = nextAudio.id;
      this.audioQueue.shift();

      // 出错时也通知监听器
      const listeners = this.playbackCompleteListeners.get(errorMessageId);
      if (listeners) {
        listeners.forEach(listener => listener());
      }

      // 执行全局监听器
      this.globalPlaybackListeners.forEach(listener => listener(errorMessageId));

      // 删除监听器（一次性事件）
      this.playbackCompleteListeners.delete(errorMessageId);

      this.playNextAudio();
    };

    // 开始播放
    nextAudio.audio.play().then(() => {
      // 语音播放成功启动时派发 viseme 数据（与语音同步）
      if (nextAudio.visemes) {
        window.dispatchEvent(new CustomEvent('visemeData', {
          detail: { messageId: nextAudio.id, visemes: nextAudio.visemes }
        }));
      }
    }).catch((error) => {
      console.error("语音播放开始错误:", error);
      const failedMessageId = nextAudio.id;
      this.audioQueue.shift();

      // 播放启动失败时也通知监听器
      const listeners = this.playbackCompleteListeners.get(failedMessageId);
      if (listeners) {
        listeners.forEach(listener => listener());
      }

      // 执行全局监听器
      this.globalPlaybackListeners.forEach(listener => listener(failedMessageId));

      // 删除监听器（一次性事件）
      this.playbackCompleteListeners.delete(failedMessageId);

      this.playNextAudio();
    });
  }

  /**
   * 从队列中删除与特定消息 ID 相关的所有语音
   *
   * 取消与指定消息 ID 相关的所有语音合成任务和语音播放。
   * 若正在播放的语音与指定 ID 匹配，则停止并从队列中删除。
   * 当多个消息的语音同时处理时，仅将特定消息的语音
   * 用于取消。
   *
   * @param {string} messageId 消息 ID
   */
  public clearAudiosByMessageId(messageId: string): void {
    // 取消正在执行的合成任务
    if (this.currentSynthesisTasks.has(messageId)) {
      this.currentSynthesisTasks.get(messageId)?.abort();
      this.currentSynthesisTasks.delete(messageId);
    }

    // 检查正在播放的语音
    if (this.audioQueue.length > 0 && this.audioQueue[0].id === messageId) {
      this.audioQueue[0].audio.pause();
      this.audioQueue.shift();
      this.isPlaying = false;

      // 通知监听器
      const listeners = this.playbackCompleteListeners.get(messageId);
      if (listeners) {
        listeners.forEach(listener => listener());
      }

      // 也通知全局监听器
      this.globalPlaybackListeners.forEach(listener => listener(messageId));

      // 删除监听器（一次性事件）
      this.playbackCompleteListeners.delete(messageId);
    }

    // 也从剩余队列中删除
    this.audioQueue = this.audioQueue.filter((item) => item.id !== messageId);

    // 恢复播放
    if (this.audioQueue.length > 0 && !this.isPlaying) {
      this.playNextAudio();
    }
  }

  /**
   * 停止所有语音播放
   *
   * 取消所有进行中的语音合成任务，停止正在播放的语音，
   * 并清空播放队列。在用户禁用语音或页面跳转等情况下
   * 会被调用。
   */
  public stopAllAudio(): void {
    // 取消所有合成任务
    this.currentSynthesisTasks.forEach((controller) => {
      controller.abort();
    });
    this.currentSynthesisTasks.clear();

    // 记录播放中的消息 ID（用于通知监听器）
    const activeMessageIds = new Set<string>();
    this.audioQueue.forEach(item => activeMessageIds.add(item.id));

    // 停止正在播放的语音
    if (this.audioQueue.length > 0) {
      this.audioQueue[0].audio.pause();
    }

    // 清空队列
    this.audioQueue = [];
    this.isPlaying = false;

    // 通知所有消息 ID 对应的监听器
    activeMessageIds.forEach(messageId => {
      const listeners = this.playbackCompleteListeners.get(messageId);
      if (listeners) {
        listeners.forEach(listener => listener());
      }

      // 也通知全局监听器
      this.globalPlaybackListeners.forEach(listener => listener(messageId));

      // 删除监听器（一次性事件）
      this.playbackCompleteListeners.delete(messageId);
    });
  }

  /**
   * 获取语音是否启用
   *
   * 返回当前语音播放的启用/禁用状态。
   *
   * @returns {boolean} 语音启用时为 true，禁用时为 false
   */
  public isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  /**
   * 获取当前音量
   *
   * 返回当前设置的音量级别。
   *
   * @returns {number} 音量（0.0-1.0 范围，0.0 为静音，1.0 为最大音量）
   */
  public getVolume(): number {
    return this.audioVolume;
  }

  /**
   * 添加在特定消息 ID 语音播放完成时执行的监听器
   * 
   * @param messageId 要监视的消息 ID
   * @param callback 播放完成时执行的回调函数
   */
  public addPlaybackCompleteListener(messageId: string, callback: () => void): void {
    if (!this.playbackCompleteListeners.has(messageId)) {
      this.playbackCompleteListeners.set(messageId, new Set());
    }
    this.playbackCompleteListeners.get(messageId)?.add(callback);
  }

  /**
   * 删除特定消息 ID 的语音播放完成监听器
   * 
   * @param messageId 目标消息 ID
   * @param callback 要删除的回调函数（省略时删除所有监听器）
   */
  public removePlaybackCompleteListener(messageId: string, callback?: () => void): void {
    if (!this.playbackCompleteListeners.has(messageId)) return;

    if (callback) {
      this.playbackCompleteListeners.get(messageId)?.delete(callback);
    } else {
      this.playbackCompleteListeners.delete(messageId);
    }
  }

  /**
   * 添加监听所有语音播放完成事件的全局监听器
   * 
   * @param callback 播放完成时执行的回调函数（消息 ID 作为参数传入）
   */
  public addGlobalPlaybackListener(callback: (messageId: string) => void): void {
    this.globalPlaybackListeners.add(callback);
  }

  /**
   * 删除全局播放完成监听器
   * 
   * @param callback 要删除的回调函数
   */
  public removeGlobalPlaybackListener(callback: (messageId: string) => void): void {
    this.globalPlaybackListeners.delete(callback);
  }
}
