/**
 * Amazon Transcribe 流式集成服务
 * 
 * 通过 WebSocket 流式传输语音，使用 Amazon Transcribe 进行实时语音识别，
 * 是本服务类的目的。支持常开麦克风输入，通过静音检测自动结束发言，
 * 并使用经过认证的 WebSocket 连接。
 */

/**
 * WebSocket 连接状态定义
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',    // 未连接
  CONNECTING = 'connecting',        // 连接中
  CONNECTED = 'connected',          // 连接完成
  CONNECTION_ERROR = 'connection_error'  // 连接错误
}
export class TranscribeService {
  private static instance: TranscribeService;
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording: boolean = false;
  private silenceDetectionTimer: ReturnType<typeof setTimeout> | null = null;
  private lastVoiceActivityTime: number = 0;

  // 连接状态管理
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  // 配置参数
  private silenceThresholdMs: number = 5000;  // 静音判定阈值（毫秒）- 麦克风长时间无输入时的安全阀
  private voiceThreshold: number = 1.5;  // 语音判定阈值（用于排除环境噪声）
  private websocketUrl: string = '';
  private language: string = 'zh';  // 语言信息
  private currentSessionId: string = '';  // 当前会话 ID

  // 自动重连与缓冲
  private audioBuffer: Array<{ audio: string, language: string }> = [];
  private isReconnecting: boolean = false;
  private maxBufferSize: number = 50; // 最大缓冲区大小（约 5 秒）
  private reconnectPromise: Promise<void> | null = null;

  // 回调函数
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onSilenceDetectedCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: ConnectionState) => void) | null = null;

  /**
   * 构造函数 - 单例模式
   */
  private constructor() {
    // 单例初始化
  }

  /**
   * 设置 WebSocket 端点
   * 
   * @param url WebSocket 端点 URL
   */
  public setWebSocketEndpoint(url: string): void {
    this.websocketUrl = url;
  }

  /**
   * 设置静音检测时长
   * @deprecated 由于 UI 设置已被删除，目前仅作为内部安全阀使用
   * @param thresholdMs 静音检测时长（毫秒）
   */
  public setSilenceThreshold(thresholdMs: number): void {
    const clampedThreshold = Math.max(500, Math.min(10000, thresholdMs));
    this.silenceThresholdMs = clampedThreshold;
  }

  /**
   * 获取当前静音检测时长
   * @deprecated 由于 UI 设置已被删除，目前仅作为内部安全阀使用
   * @returns {number} 静音检测时长（毫秒）
   */
  public getSilenceThreshold(): number {
    return this.silenceThresholdMs;
  }

  /**
   * 设置语音判定阈值
   * @param threshold 语音判定阈值（0.1〜10.0）
   */
  public setVoiceThreshold(threshold: number): void {
    this.voiceThreshold = Math.max(0.1, Math.min(10.0, threshold));
  }

  /**
   * 修改连接状态（内部使用）
   * 
   * @private
   * @param {ConnectionState} newState 新的连接状态
   */
  private setConnectionState(newState: ConnectionState): void {
    if (this.connectionState !== newState) {
      const oldState = this.connectionState;
      this.connectionState = newState;
      console.warn(`连接状态变更: ${oldState} → ${newState}`);

      // 执行连接状态变更回调
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(newState);
      }
    }
  }

  /**
   * 获取当前连接状态
   * 
   * @returns {ConnectionState} 当前连接状态
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 设置连接状态变更时的回调
   * 
   * @param {function} callback 连接状态变更时被调用的回调函数
   */
  public setOnConnectionStateChange(callback: (state: ConnectionState) => void | null): void {
    this.onConnectionStateChangeCallback = callback;
  }

  /**
   * 获取单例实例
   *
   * @returns {TranscribeService} 单例实例
   */
  public static getInstance(): TranscribeService {
    if (!TranscribeService.instance) {
      TranscribeService.instance = new TranscribeService();
    }
    return TranscribeService.instance;
  }

  /**
   * 初始化 WebSocket 连接
   *
   * @param sessionId 会话 ID
   * @param language 语言设置（例：'ja'、'en'）
   */
  public async initializeConnection(sessionId: string, language?: string): Promise<void> {
    // 保存会话 ID 和语言信息
    this.currentSessionId = sessionId;
    this.language = language || 'zh';
    if (!this.websocketUrl) {
      this.setConnectionState(ConnectionState.CONNECTION_ERROR);
      throw new Error('未配置 WebSocket 端点');
    }

    // 关闭现有连接
    this.closeConnection();

    // 切换为连接开始状态
    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      // 从 AuthService 获取认证令牌
      const { AuthService } = await import('./AuthService');
      const authService = AuthService.getInstance();
      const token = await authService.getAuthToken();

      if (!token) {
        throw new Error('无法获取认证令牌');
      }

      // 带认证令牌的连接 URL
      const authenticatedUrl = `${this.websocketUrl}?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;

      return new Promise((resolve, reject) => {
        try {
          this.socket = new WebSocket(authenticatedUrl);

          this.socket.onopen = () => {
            this.setConnectionState(ConnectionState.CONNECTED);
            resolve();
          };

          this.socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.transcript && this.onTranscriptCallback) {
                // isPartial: true=中间识别、false=最终确认（遵循 AWS Transcribe API 标准）
                this.onTranscriptCallback(data.transcript, data.isPartial || false);
              }

              // 忽略 Lambda 端的 voiceActivity（优先使用前端语音电平判定）
              // 实际语音电平检测在 audioProcessor 中进行
            } catch (error) {
              console.error('WebSocket消息解析错误:', error);
            }
          };

          this.socket.onerror = (error) => {
            console.error('WebSocket错误:', error);
            this.setConnectionState(ConnectionState.CONNECTION_ERROR);
            reject(error);
          };

          this.socket.onclose = (event) => {
            console.warn(`WebSocket断开: 代码=${event.code}, wasClean=${event.wasClean}`);

            // 若正处于语音识别中，则在下次语音检测时准备自动重连
            if (this.isRecording) {
              console.warn('语音识别中检测到断开，将在下一次语音时重新连接');
            }
            this.setConnectionState(ConnectionState.DISCONNECTED);
          };
        } catch (error) {
          console.error('WebSocket初始化错误:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('WebSocket连接错误:', error);
      this.setConnectionState(ConnectionState.CONNECTION_ERROR);
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error('WebSocket 连接错误'));
      }
      throw error;
    }
  }

  /**
   * 自动重连（若已在重连中则返回现有 Promise）
   * 
   * @private
   * @returns {Promise<void>} 重连完成的 Promise
   */
  private async autoReconnect(): Promise<void> {
    // 若已在重连中，则等待其完成
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    if (!this.currentSessionId) {
      console.error('未设置会话ID，无法重新连接');
      return;
    }

    this.isReconnecting = true;

    this.reconnectPromise = (async () => {
      try {
        await this.initializeConnection(this.currentSessionId, this.language);
        console.warn('自动重连完成');

        // 发送缓冲区中累积的音频数据
        if (this.audioBuffer.length > 0) {
          for (const bufferedData of this.audioBuffer) {
            if (this.socket?.readyState === WebSocket.OPEN) {
              this.socket.send(JSON.stringify({
                action: 'sendAudio',
                audio: bufferedData.audio,
                language: bufferedData.language
              }));
            }
          }
          this.audioBuffer = [];
        }
      } catch (error) {
        console.error('❌ 自动重连失败:', error);
        throw error;
      } finally {
        this.isReconnecting = false;
        this.reconnectPromise = null;
      }
    })();

    return this.reconnectPromise;
  }

  /**
   * 开始语音识别
   *
   * @param onTranscript 文本识别时的回调（text：识别文本，isPartial：true=中间识别/false=最终确认）
   * @param onSilence 静音检测时的回调
   * @param onError 发生错误时的回调
   */
  public async startListening(
    onTranscript: (text: string, isPartial: boolean) => void,
    onSilence?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.isRecording) {
      this.stopListening();
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 连接未建立');
    }

    this.onTranscriptCallback = onTranscript;
    this.onSilenceDetectedCallback = onSilence || null;
    this.onErrorCallback = onError || null;

    try {
      // 请求麦克风访问权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,  // 按 Transcribe 要求设置为 16kHz
          channelCount: 1     // 单声道
        }
      });

      // 使用 Web Audio API 以 PCM 格式处理
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      this.mediaStream = stream;
      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.audioProcessor.onaudioprocess = (event) => {
        try {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // 计算语音电平（RMS 值）
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          const audioLevel = rms * 100; // 转换为 0-100 的刻度

          // 仅当语音电平超过阈值时更新语音活动
          const isVoiceDetected = audioLevel > this.voiceThreshold;

          if (isVoiceDetected) {
            this.lastVoiceActivityTime = Date.now();

            // 语音检测时若连接已断开则自动重连
            if (!this.isConnected() && !this.isReconnecting && this.currentSessionId) {
              this.autoReconnect().catch(err => {
                console.error('自动重新连接错误:', err);
                if (this.onErrorCallback) {
                  this.onErrorCallback(err instanceof Error ? err : new Error('自动重连失败'));
                }
              });
            }
          }

          // 将 Float32Array 转换为 Int16Array（PCM 16bit）
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            // 将 -1.0 到 1.0 的范围转换为 -32768 到 32767 的范围
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
          }

          // 将 Int16Array 转换为 Uint8Array 并进行 Base64 编码
          const uint8Array = new Uint8Array(pcmData.buffer);
          const base64Audio = this.arrayBufferToBase64(uint8Array.buffer);

          // 根据连接状态选择发送或缓冲
          if (this.socket?.readyState === WebSocket.OPEN && !this.isReconnecting) {
            // 已连接：直接发送
            this.socket.send(JSON.stringify({
              action: 'sendAudio',
              audio: base64Audio,
              language: this.language  // 添加语言信息
            }));
          } else if (isVoiceDetected) {
            // 语音检测中但未连接：存入缓冲区
            this.audioBuffer.push({
              audio: base64Audio,
              language: this.language
            });

            // 缓冲区大小限制
            if (this.audioBuffer.length > this.maxBufferSize) {
              this.audioBuffer.shift(); // 删除旧数据
              console.warn('⚠️ 缓冲区已满，删除旧数据');
            }
          }
        } catch (error) {
          console.error('语音数据处理错误:', error);
        }
      };

      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);

      // 设置静音检测定时器
      this.lastVoiceActivityTime = Date.now();
      this.startSilenceDetection();

      this.isRecording = true;
    } catch (error) {
      console.error('语音识别开始错误:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error('语音识别开始错误'));
      }
      throw error;
    }
  }

  /**
   * 开始静音检测处理
   *
   * @private
   */
  private startSilenceDetection(): void {
    // 清除现有定时器
    if (this.silenceDetectionTimer) {
      clearInterval(this.silenceDetectionTimer);
    }

    // 定期检查静音状态
    this.silenceDetectionTimer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastVoiceActivityTime;

      // 当静音持续超过设定阈值时
      if (elapsed > this.silenceThresholdMs) {

        if (this.onSilenceDetectedCallback) {
          this.onSilenceDetectedCallback();

          // 静音检测后暂停检测（防止连续触发）
          this.lastVoiceActivityTime = now;
        }
      }
    }, 500);
  }

  /**
   * 停止语音识别
   */
  public stopListening(): void {
    // 停止静音检测定时器
    if (this.silenceDetectionTimer) {
      clearInterval(this.silenceDetectionTimer);
      this.silenceDetectionTimer = null;
    }

    // 停止 Web Audio API 资源
    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect();
        this.audioProcessor = null;
      } catch (e) {
        console.warn('AudioProcessor停止错误:', e);
      }
    }

    // 停止 MediaStream
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      } catch (e) {
        console.warn('MediaStream停止错误:', e);
      }
    }

    // 自动麦克风模式会在每个用户回合重新开启收音；每次停止时及时释放
    // AudioContext，避免长会话累积浏览器音频资源。
    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch (e) {
        console.warn('AudioContext停止错误:', e);
      }
      this.audioContext = null;
    }

    this.isRecording = false;
  }

  /**
   * 关闭 WebSocket 连接
   */
  private closeConnection(): void {
    if (this.socket) {
      try {
        if (this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close();
        }
      } catch (e) {
        console.warn('WebSocket断开错误:', e);
      }
      this.socket = null;
    }
    // 手动断开时设置为断开状态
    if (this.connectionState !== ConnectionState.CONNECTION_ERROR) {
      this.setConnectionState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.stopListening();
    this.closeConnection();

    // 清空缓冲区
    this.audioBuffer = [];
    this.isReconnecting = false;
    this.reconnectPromise = null;

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.warn('AudioContext停止错误:', e);
      }
      this.audioContext = null;
    }
  }

  /**
   * 获取当前是否正在语音识别
   *
   * @returns {boolean} 正在语音识别时返回 true
   */
  public isListening(): boolean {
    return this.isRecording;
  }

  /**
   * 检查 WebSocket 是否已连接
   *
   * @returns {boolean} 已连接时返回 true
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * 将 ArrayBuffer 转换为 Base64
   *
   * @param buffer 要转换的 ArrayBuffer
   * @returns {string} Base64 编码的字符串
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }
    return window.btoa(chunks.join(''));
  }
}

// WebAudioAPI 用的类型定义
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
