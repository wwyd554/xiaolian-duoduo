/**
 * 口型同步控制器
 * Phase 2：基于 Viseme 的元音口型同步（联动 Polly Speech Marks）
 * Phase 1 回退：基于音量的口型同步
 */
import { VRM } from '@pixiv/three-vrm';
import { VisemeData, POLLY_VISEME_TO_VOWEL } from '../../types/avatar';

// 嘴型的过渡速度
const MOUTH_TRANSITION_SPEED = 12.0;
// Phase 1 回退用设置
const VOLUME_THRESHOLD = 0.01;
const MAX_MOUTH_OPEN = 0.8;

// VRM 元音混合变形名称
const VOWEL_BLEND_SHAPES: Record<VisemeData['value'], string> = {
  a: 'aa',
  i: 'ih',
  u: 'ou',
  e: 'ee',
  o: 'oh',
  sil: '',
};

export class LipSyncController {
  private vrm: VRM;
  // Phase 2：基于 Viseme
  private visemeData: VisemeData[] = [];
  private visemeStartTime: number = 0;
  private isVisemePlaying: boolean = false;
  private currentVisemeIndex: number = 0;
  // 当前各元音的强度
  private currentValues: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  private targetValues: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

  // Phase 1 回退：基于音量
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private dataArray: Uint8Array | null = null;
  private currentMouthOpen: number = 0;
  private isConnected: boolean = false;
  private useVisemeMode: boolean = false;
  private mutationObserver: MutationObserver | null = null;

  constructor(vrm: VRM) {
    this.vrm = vrm;
  }

  /**
   * 设置 Viseme 数据以启用 viseme 模式
   */
  setVisemeData(rawVisemes: Array<{ time: number; type: string; value: string }>): void {
    // 将 Polly viseme 转换为日语元音
    this.visemeData = rawVisemes.map(v => ({
      time: v.time,
      value: POLLY_VISEME_TO_VOWEL[v.value] || 'sil',
    }));
    this.currentVisemeIndex = 0;
    this.useVisemeMode = true;
  }

  /**
   * 开始 Viseme 播放（与音频播放开始同时调用）
   */
  startVisemePlayback(): void {
    if (this.visemeData.length === 0) return;
    this.visemeStartTime = performance.now();
    this.isVisemePlaying = true;
    this.currentVisemeIndex = 0;
  }

  /**
   * 停止 Viseme 播放
   */
  stopVisemePlayback(): void {
    this.isVisemePlaying = false;
    this.visemeData = [];
    this.currentVisemeIndex = 0;
    // 重置所有嘴型
    this.targetValues = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  }

  /**
   * 从 AudioService 获取音频元素并连接（Phase 1 回退）
   */
  connectToAudioService(): void {
    if (this.isConnected) return;
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.setupAudioMonitoring();
      this.isConnected = true;
    } catch (error) {
      console.error('LipSyncController: 连接错误:', error);
    }
  }

  private setupAudioMonitoring(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLAudioElement) {
            this.connectToAudioElement(node);
          }
        });
      });
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('audio').forEach((audio) => {
      this.connectToAudioElement(audio);
    });
  }

  private connectToAudioElement(audioElement: HTMLAudioElement): void {
    if (!this.audioContext || !this.analyser) return;
    try {
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch {
      // 已连接时会报错，但忽略
    }
  }

  /**
   * 每帧调用，更新嘴型
   */
  update(deltaTime: number): void {
    if (!this.vrm.expressionManager) return;

    if (this.useVisemeMode && this.isVisemePlaying) {
      this.updateVisemeMode(deltaTime);
    } else {
      this.updateVolumeMode(deltaTime);
    }
  }

  /**
   * Phase 2：基于 Viseme 的嘴型更新
   */
  private updateVisemeMode(deltaTime: number): void {
    if (!this.vrm.expressionManager) return;

    const elapsed = performance.now() - this.visemeStartTime;

    // 确定当前 viseme
    while (
      this.currentVisemeIndex < this.visemeData.length - 1 &&
      this.visemeData[this.currentVisemeIndex + 1].time <= elapsed
    ) {
      this.currentVisemeIndex++;
    }

    // 播放完成检查：距最后一个 viseme 超过一定时间后结束
    const lastViseme = this.visemeData[this.visemeData.length - 1];
    if (this.currentVisemeIndex >= this.visemeData.length - 1 && elapsed > lastViseme.time + 200) {
      this.stopVisemePlayback();
      return;
    }

    const currentViseme = this.visemeData[this.currentVisemeIndex];

    // 重置目标值
    this.targetValues = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

    // 将当前 viseme 对应的混合变形设为目标
    if (currentViseme.value !== 'sil') {
      const blendShape = VOWEL_BLEND_SHAPES[currentViseme.value];
      if (blendShape) {
        this.targetValues[blendShape] = 0.8;
      }
    }

    // 平滑过渡
    const step = MOUTH_TRANSITION_SPEED * deltaTime;
    for (const key of Object.keys(this.currentValues)) {
      const target = this.targetValues[key] || 0;
      if (this.currentValues[key] < target) {
        this.currentValues[key] = Math.min(target, this.currentValues[key] + step);
      } else {
        this.currentValues[key] = Math.max(target, this.currentValues[key] - step);
      }
      this.vrm.expressionManager!.setValue(key, this.currentValues[key]);
    }
  }

  /**
   * Phase 1 回退：基于音量的嘴型更新
   */
  private updateVolumeMode(deltaTime: number): void {
    if (!this.vrm.expressionManager) return;

    let targetMouthOpen = 0;
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length / 255;
      if (average > VOLUME_THRESHOLD) {
        targetMouthOpen = Math.min(average * 3, MAX_MOUTH_OPEN);
      }
    }

    const speed = targetMouthOpen > this.currentMouthOpen ? 15.0 : 10.0;
    if (this.currentMouthOpen < targetMouthOpen) {
      this.currentMouthOpen = Math.min(targetMouthOpen, this.currentMouthOpen + speed * deltaTime);
    } else {
      this.currentMouthOpen = Math.max(targetMouthOpen, this.currentMouthOpen - speed * deltaTime);
    }
    this.vrm.expressionManager.setValue('aa', this.currentMouthOpen);
  }

  /**
   * 断开音频连接
   */
  disconnect(): void {
    this.stopVisemePlayback();
    // 立即重置嘴型
    this.currentMouthOpen = 0;
    this.currentValues = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this.useVisemeMode = false;
    // 直接重置 VRM 表情（即使不调用 update() 也能闭嘴）
    if (this.vrm.expressionManager) {
      this.vrm.expressionManager.setValue('aa', 0);
      this.vrm.expressionManager.setValue('ih', 0);
      this.vrm.expressionManager.setValue('ou', 0);
      this.vrm.expressionManager.setValue('ee', 0);
      this.vrm.expressionManager.setValue('oh', 0);
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
    this.isConnected = false;
  }

  /**
   * 资源释放
   */
  dispose(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.disconnect();
  }
}

export default LipSyncController;
