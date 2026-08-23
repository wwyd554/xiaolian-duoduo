/**
 * 动画控制器
 * 控制眨眼、呼吸、手势、待机动作的程序化动画
 */
import { VRM } from '@pixiv/three-vrm';
import { GestureType } from '../../types/avatar';

// 眨眼的设置
const BLINK_MIN_INTERVAL = 2.0;
const BLINK_MAX_INTERVAL = 6.0;
const BLINK_DURATION = 0.1;

// 呼吸的设置
const BREATH_CYCLE = 4.0;
const BREATH_AMPLITUDE = 0.005;

// 手势的设置
const NOD_DURATION = 0.6; // 点头总时长（秒）
const NOD_ANGLE = 0.15; // 点头角度（弧度，约 8.6 度）
const HEAD_TILT_DURATION = 0.8; // 歪头总时长（秒）
const HEAD_TILT_ANGLE = 0.12; // 歪头角度（弧度，约 6.9 度）

// 待机动作：视线移动的设置
const GAZE_MIN_INTERVAL = 3.0;
const GAZE_MAX_INTERVAL = 8.0;
const GAZE_TRANSITION_SPEED = 1.5; // 視線移動速度
const GAZE_RANGE_H = 0.26; // 水平范围（弧度，约 15 度）
const GAZE_RANGE_V = 0.17; // 垂直范围（弧度，约 10 度）

// 待机动作：身体摇晃的设置
const SWAY_CYCLE_MIN = 5.0;
const SWAY_CYCLE_MAX = 10.0;
const SWAY_AMPLITUDE = 0.0087; // 約0.5度

// 发言中、手势中时待机动作的抑制率
const IDLE_SUPPRESSION = 0.5;

export class AnimationController {
  private vrm: VRM;
  private isRunning: boolean = false;
  private isSpeaking: boolean = false;
  private expressionController: { getExpressionBlinkValue(): number } | null = null;

  // 用于眨眼
  private nextBlinkTime: number = 0;
  private isBlinking: boolean = false;
  private blinkProgress: number = 0;

  // 呼吸用
  private breathTime: number = 0;
  private initialHipsY: number = 0;

  // 用于手势
  private activeGesture: GestureType = 'none';
  private gestureProgress: number = 0;
  private gestureInitialRotationX: number = 0;
  private gestureInitialRotationZ: number = 0;

  // 視線移動用
  private nextGazeTime: number = 0;
  private currentGazeH: number = 0;
  private currentGazeV: number = 0;
  private targetGazeH: number = 0;
  private targetGazeV: number = 0;

  // 用于身体摇晃
  private swayCycle: number = 7.0;
  private swayTime: number = 0;
  private initialSpineRotationZ: number = 0;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.scheduleNextBlink();
    this.scheduleNextGaze();
    this.swayCycle = SWAY_CYCLE_MIN + Math.random() * (SWAY_CYCLE_MAX - SWAY_CYCLE_MIN);

    // 保存初始位置
    const hips = this.vrm.humanoid?.getNormalizedBoneNode('hips');
    if (hips) {
      this.initialHipsY = hips.position.y;
    }
    const spine = this.vrm.humanoid?.getNormalizedBoneNode('spine');
    if (spine) {
      this.initialSpineRotationZ = spine.rotation.z;
    }

    // 初始姿势设置：从 T 姿势改为自然姿势
    this.applyInitialPose();
  }

  /**
   * 从 T 姿势改为自然的站立姿势
   * 设置双臂自然垂于身体两侧、微曲的姿势
   */
  private applyInitialPose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    // 上臂：垂于身体两侧（Z 轴旋转）
    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
    if (leftUpperArm) {
      leftUpperArm.rotation.z = -1.3; // 放下约 75 度（贴近身体）
    }
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
    if (rightUpperArm) {
      rightUpperArm.rotation.z = 1.3;
    }

    // 前臂：轻微向前弯曲（自然下垂）
    const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
    if (leftLowerArm) {
      leftLowerArm.rotation.y = 0.3;
    }
    const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
    if (rightLowerArm) {
      rightLowerArm.rotation.y = -0.3;
    }

    // 肩膀：轻微下沉
    const leftShoulder = humanoid.getNormalizedBoneNode('leftShoulder');
    if (leftShoulder) {
      leftShoulder.rotation.z = -0.05;
    }
    const rightShoulder = humanoid.getNormalizedBoneNode('rightShoulder');
    if (rightShoulder) {
      rightShoulder.rotation.z = 0.05;
    }
  }

  private scheduleNextBlink(): void {
    this.nextBlinkTime = BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
  }

  private scheduleNextGaze(): void {
    this.nextGazeTime = GAZE_MIN_INTERVAL + Math.random() * (GAZE_MAX_INTERVAL - GAZE_MIN_INTERVAL);
  }

  /** 开始待机动画 */
  startIdleAnimations(): void {
    this.isRunning = true;
  }

  /** 停止待机动画 */
  stopIdleAnimations(): void {
    this.isRunning = false;
  }

  /** 设置发言状态（用于抑制待机动作） */
  setIsSpeaking(speaking: boolean): void {
    this.isSpeaking = speaking;
  }

  /** 设置 ExpressionController 的引用（用于避免 blink 冲突） */
  setExpressionController(controller: { getExpressionBlinkValue(): number } | null): void {
    this.expressionController = controller;
  }

  /**
   * 触发点头手势
   */
  triggerNod(): void {
    if (this.activeGesture !== 'none') return; // 已处于手势中
    this.activeGesture = 'nod';
    this.gestureProgress = 0;
    const head = this.vrm.humanoid?.getNormalizedBoneNode('head');
    if (head) {
      this.gestureInitialRotationX = head.rotation.x;
    }
  }

  /**
   * 触发歪头手势
   */
  triggerHeadTilt(): void {
    if (this.activeGesture !== 'none') return;
    this.activeGesture = 'headTilt';
    this.gestureProgress = 0;
    const head = this.vrm.humanoid?.getNormalizedBoneNode('head');
    if (head) {
      this.gestureInitialRotationZ = head.rotation.z;
    }
  }

  /**
   * 从外部触发手势
   */
  triggerGesture(gesture: GestureType): void {
    if (gesture === 'nod') {
      this.triggerNod();
    } else if (gesture === 'headTilt') {
      this.triggerHeadTilt();
    }
  }

  /** 每帧调用 */
  update(deltaTime: number): void {
    if (!this.isRunning) return;

    this.updateBlink(deltaTime);
    this.updateBreath(deltaTime);
    this.updateGesture(deltaTime);
    this.updateGaze(deltaTime);
    this.updateSway(deltaTime);
  }

  /** 眨眼的更新 */
  private updateBlink(deltaTime: number): void {
    if (!this.vrm.expressionManager) return;

    // ExpressionController 获取表情混合中使用的 blink 值
    // （例如：angry 表情的眯眼效果 blink: 0.3）
    const expressionBlinkValue = this.expressionController?.getExpressionBlinkValue() ?? 0;

    if (this.isBlinking) {
      this.blinkProgress += deltaTime / BLINK_DURATION;
      if (this.blinkProgress >= 1) {
        this.isBlinking = false;
        this.blinkProgress = 0;
        // 避免低于表情混合的 blink 值
        this.vrm.expressionManager.setValue('blink', expressionBlinkValue);
        this.scheduleNextBlink();
      } else {
        const blinkValue = this.blinkProgress < 0.5
          ? this.blinkProgress * 2
          : (1 - this.blinkProgress) * 2;
        // 取眨眼动画值与表情混合值中较大者
        this.vrm.expressionManager.setValue('blink', Math.max(blinkValue, expressionBlinkValue));
      }
    } else {
      this.nextBlinkTime -= deltaTime;
      if (this.nextBlinkTime <= 0) {
        this.isBlinking = true;
        this.blinkProgress = 0;
      }
    }
  }

  /** 呼吸的更新 */
  private updateBreath(deltaTime: number): void {
    const hips = this.vrm.humanoid?.getNormalizedBoneNode('hips');
    if (!hips) return;

    this.breathTime += deltaTime;
    const breathOffset = Math.sin((this.breathTime / BREATH_CYCLE) * Math.PI * 2) * BREATH_AMPLITUDE;
    hips.position.y = this.initialHipsY + breathOffset;
  }

  /** 手势的更新 */
  private updateGesture(deltaTime: number): void {
    if (this.activeGesture === 'none') return;

    const head = this.vrm.humanoid?.getNormalizedBoneNode('head');
    if (!head) {
      this.activeGesture = 'none';
      return;
    }

    if (this.activeGesture === 'nod') {
      this.gestureProgress += deltaTime / NOD_DURATION;
      if (this.gestureProgress >= 1) {
        // 点头完成，恢复原状
        head.rotation.x = this.gestureInitialRotationX;
        this.activeGesture = 'none';
      } else {
        // 以正弦波做下→上→下的动作（点头两次）
        const nodOffset = Math.sin(this.gestureProgress * Math.PI * 2) * NOD_ANGLE;
        head.rotation.x = this.gestureInitialRotationX + nodOffset;
      }
    } else if (this.activeGesture === 'headTilt') {
      this.gestureProgress += deltaTime / HEAD_TILT_DURATION;
      if (this.gestureProgress >= 1) {
        head.rotation.z = this.gestureInitialRotationZ;
        this.activeGesture = 'none';
      } else {
        // 倾斜后回正（单向）
        const tiltPhase = this.gestureProgress < 0.5
          ? this.gestureProgress * 2 // 0→1（倾斜）
          : (1 - this.gestureProgress) * 2; // 1→0（回正）
        const tiltOffset = tiltPhase * HEAD_TILT_ANGLE;
        head.rotation.z = this.gestureInitialRotationZ + tiltOffset;
      }
    }
  }

  /** 视线移动的更新 */
  private updateGaze(deltaTime: number): void {
    // 抑制率的计算
    const suppression = (this.isSpeaking || this.activeGesture !== 'none') ? IDLE_SUPPRESSION : 1.0;

    this.nextGazeTime -= deltaTime;
    if (this.nextGazeTime <= 0) {
      // 设置新的视线目标
      this.targetGazeH = (Math.random() * 2 - 1) * GAZE_RANGE_H * suppression;
      this.targetGazeV = (Math.random() * 2 - 1) * GAZE_RANGE_V * suppression;
      this.scheduleNextGaze();
    }

    // 将当前视线平滑地移向目标
    const step = GAZE_TRANSITION_SPEED * deltaTime;
    this.currentGazeH += Math.sign(this.targetGazeH - this.currentGazeH) * Math.min(step, Math.abs(this.targetGazeH - this.currentGazeH));
    this.currentGazeV += Math.sign(this.targetGazeV - this.currentGazeV) * Math.min(step, Math.abs(this.targetGazeV - this.currentGazeV));

    // 通过 VRM lookAt 设置视线
    if (this.vrm.lookAt) {
      this.vrm.lookAt.yaw = (this.currentGazeH / Math.PI) * 180;
      this.vrm.lookAt.pitch = (this.currentGazeV / Math.PI) * 180;
    }
  }

  /** 身体摇晃的更新 */
  private updateSway(deltaTime: number): void {
    const spine = this.vrm.humanoid?.getNormalizedBoneNode('spine');
    if (!spine) return;

    const suppression = (this.isSpeaking || this.activeGesture !== 'none') ? IDLE_SUPPRESSION : 1.0;

    this.swayTime += deltaTime;
    const swayOffset = Math.sin((this.swayTime / this.swayCycle) * Math.PI * 2) * SWAY_AMPLITUDE * suppression;
    spine.rotation.z = this.initialSpineRotationZ + swayOffset;
  }

  /** 资源释放 */
  dispose(): void {
    this.isRunning = false;
  }
}

export default AnimationController;
