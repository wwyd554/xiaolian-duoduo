/**
 * VRM 表情控制器
 * 控制从感情状态到 VRM 表情的映射与平滑过渡
 */
import { VRM } from '@pixiv/three-vrm';
import { EmotionState } from '../../types/index';
import { EMOTION_TO_VRM_EXPRESSION, ExpressionBlendEntry, VRMExpressionName } from '../../types/avatar';

// 过渡速度（每秒变化量）- 默认
const DEFAULT_TRANSITION_SPEED = 3.0;

// 按感情类型区分的过渡速度
const EMOTION_TRANSITION_SPEEDS: Record<string, number> = {
  angry: 5.0,    // 急剧的感情变化 → 高速
  sad: 2.0,      // 平缓的感情变化 → 低速
  happy: 3.5,    // 稍快
  relaxed: 2.0,  // 平缓 → 低速
  neutral: 3.0,  // 標準
};

// 感情之间的中间状态映射（自然的过渡路径）
// 仅定义需要中间状态的场景，未定义则直接过渡。
const EMOTION_TRANSITION_PATH: Partial<Record<string, Partial<Record<string, string>>>> = {
  neutral: { happy: 'relaxed' },
  happy: { sad: 'neutral' },
  angry: { relaxed: 'neutral' },
  sad: { happy: 'neutral', relaxed: 'neutral' },
  relaxed: { angry: 'neutral', sad: 'neutral' },
};

// VRM 表情名称的映射（支持 VRoid Studio / VRM 1.0）
// VRoid Studio 创建的模型可能使用不同的表情名称
const EXPRESSION_NAME_MAP: Record<string, string[]> = {
  happy: ['happy', 'Joy', 'joy', 'Happy', 'smile', 'Smile'],
  angry: ['angry', 'Angry', 'anger', 'Anger'],
  sad: ['sad', 'Sad', 'sorrow', 'Sorrow'],
  relaxed: ['relaxed', 'Relaxed', 'neutral', 'Neutral'],
  surprised: ['surprised', 'Surprised', 'surprise', 'Surprise'],
};

export class ExpressionController {
  private vrm: VRM;
  private currentExpression: VRMExpressionName = 'neutral';
  private currentIntensity: number = 0;
  private targetExpression: VRMExpressionName = 'neutral';
  private targetIntensity: number = 0;
  private targetBlend: ExpressionBlendEntry[] = [];
  private availableExpressions: string[] = [];
  // 用于中间状态过渡
  private intermediateExpression: VRMExpressionName | null = null;
  private transitionPhase: 'direct' | 'fadeOut' | 'intermediate' | 'fadeIn' = 'direct';
  // 変更検知用
  private isDirty: boolean = true;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    // 获取可用表情
    if (vrm.expressionManager) {
      this.availableExpressions = vrm.expressionManager.expressions.map(e => e.expressionName);
    }
  }

  /**
   * 获取实际可用的表情名称
   */
  private getActualExpressionName(targetName: string): string | null {
    // 首先尝试直接匹配
    if (this.availableExpressions.includes(targetName)) {
      return targetName;
    }

    // 从映射中查找
    const candidates = EXPRESSION_NAME_MAP[targetName] || [targetName];
    for (const candidate of candidates) {
      if (this.availableExpressions.includes(candidate)) {
        return candidate;
      }
    }

    // 以部分匹配查找（忽略大小写）
    const lowerTarget = targetName.toLowerCase();
    for (const expr of this.availableExpressions) {
      if (expr.toLowerCase().includes(lowerTarget) || lowerTarget.includes(expr.toLowerCase())) {
        return expr;
      }
    }

    return null;
  }

  /**
   * 设置感情状态
   */
  setEmotion(emotion: EmotionState): void {
    const mapping = EMOTION_TO_VRM_EXPRESSION[emotion];
    const previousExpression = this.targetExpression;
    this.targetExpression = mapping.expression;
    this.targetIntensity = mapping.intensity;
    this.targetBlend = mapping.blend ?? [];
    this.isDirty = true;

    // 中间状态过渡的判定
    if (previousExpression !== mapping.expression && previousExpression !== 'neutral') {
      const paths = EMOTION_TRANSITION_PATH[previousExpression];
      const intermediate = paths?.[mapping.expression];
      if (intermediate) {
        this.intermediateExpression = intermediate as VRMExpressionName;
        this.transitionPhase = 'fadeOut';
      } else {
        this.intermediateExpression = null;
        this.transitionPhase = 'direct';
      }
    } else {
      this.intermediateExpression = null;
      this.transitionPhase = 'direct';
    }
  }

  /**
   * 每帧调用，平滑过渡表情
   * ※ 必须在 vrm.update() 之前调用（vrm.update() 内部会执行 expressionManager.update()）
   */
  update(deltaTime: number): void {
    if (!this.vrm.expressionManager) return;

    // 无变化且已到达目标时跳过
    if (!this.isDirty && this.currentExpression === this.targetExpression &&
      Math.abs(this.currentIntensity - this.targetIntensity) < 0.001) {
      return;
    }

    // 获取按感情类型区分的过渡速度
    const speed = EMOTION_TRANSITION_SPEEDS[this.targetExpression] || DEFAULT_TRANSITION_SPEED;
    const step = speed * deltaTime;

    // 中间状态过渡处理
    if (this.intermediateExpression && this.transitionPhase !== 'direct') {
      this.updateIntermediateTransition(step);
    } else {
      // 直接过渡（原有逻辑）
      this.updateDirectTransition(step);
    }

    // 重置所有表情（包括用于混合的表情）
    const resetExpressions = ['happy', 'angry', 'sad', 'relaxed', 'blink'];
    for (const exprName of resetExpressions) {
      const actualName = this.getActualExpressionName(exprName);
      if (actualName) {
        this.vrm.expressionManager.setValue(actualName, 0);
      }
    }

    // 应用当前表情
    if (this.currentExpression !== 'neutral') {
      const actualName = this.getActualExpressionName(this.currentExpression);
      if (actualName) {
        this.vrm.expressionManager.setValue(actualName, this.currentIntensity);
      }
    }

    // 应用混合表情
    if (this.currentExpression === this.targetExpression && this.targetBlend.length > 0) {
      const blendRatio = this.targetIntensity > 0 ? this.currentIntensity / this.targetIntensity : 0;
      for (const entry of this.targetBlend) {
        const actualName = this.getActualExpressionName(entry.name);
        if (actualName) {
          this.vrm.expressionManager.setValue(actualName, entry.intensity * blendRatio);
        }
      }
    }

    // 到达目标后清除 dirty 标志
    if (this.currentExpression === this.targetExpression &&
      Math.abs(this.currentIntensity - this.targetIntensity) < 0.001) {
      this.isDirty = false;
    }
  }

  /**
   * 经中间状态的过渡
   */
  private updateIntermediateTransition(step: number): void {
    if (this.transitionPhase === 'fadeOut') {
      // 淡出当前表情
      this.currentIntensity = Math.max(0, this.currentIntensity - step);
      if (this.currentIntensity <= 0) {
        // 切换到中间状态
        this.currentExpression = this.intermediateExpression!;
        this.transitionPhase = 'intermediate';
      }
    } else if (this.transitionPhase === 'intermediate') {
      // 短暂显示中间状态
      this.currentIntensity = Math.min(0.4, this.currentIntensity + step);
      if (this.currentIntensity >= 0.4) {
        // 开始淡入到目标
        this.transitionPhase = 'fadeIn';
      }
    } else if (this.transitionPhase === 'fadeIn') {
      // 从中间状态淡出到目标
      this.currentIntensity = Math.max(0, this.currentIntensity - step);
      if (this.currentIntensity <= 0) {
        this.currentExpression = this.targetExpression;
        this.currentIntensity = 0;
        this.intermediateExpression = null;
        this.transitionPhase = 'direct';
      }
    }
  }

  /**
   * 直接过渡（原有逻辑）
   */
  private updateDirectTransition(step: number): void {
    if (this.currentExpression !== this.targetExpression) {
      this.currentIntensity = Math.max(0, this.currentIntensity - step);
      if (this.currentIntensity <= 0) {
        this.currentExpression = this.targetExpression;
        this.currentIntensity = 0;
      }
    } else {
      if (this.currentIntensity < this.targetIntensity) {
        this.currentIntensity = Math.min(this.targetIntensity, this.currentIntensity + step);
      } else if (this.currentIntensity > this.targetIntensity) {
        this.currentIntensity = Math.max(this.targetIntensity, this.currentIntensity - step);
      }
    }
  }

  /**
   * 获取当前表情混合中使用的 blink 值
   * 为避免 AnimationController 与眨眼动画冲突
   */
  getExpressionBlinkValue(): number {
    // 未到达目标表情时为 0
    if (this.currentExpression !== this.targetExpression) return 0;
    if (this.targetBlend.length === 0) return 0;

    const blinkEntry = this.targetBlend.find(e => e.name === 'blink');
    if (!blinkEntry) return 0;

    const blendRatio = this.targetIntensity > 0 ? this.currentIntensity / this.targetIntensity : 0;
    return blinkEntry.intensity * blendRatio;
  }

  /**
   * 资源释放
   */
  dispose(): void {
    // 特别地，无需释放资源
  }
}

export default ExpressionController;
