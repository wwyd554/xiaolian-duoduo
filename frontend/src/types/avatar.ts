/**
 * 头像相关的类型定义
 */
import { EmotionState } from './index';

/**
 * 头像信息（DynamoDB 管理）
 */
export interface AvatarInfo {
  id: string;
  name: string;
  modelPath: string;
  s3Key?: string;
  thumbnail?: string;
  description?: string;
  isDefault?: boolean;
}

/**
 * Polly viseme 到元音的映射
 */
export const POLLY_VISEME_TO_VOWEL: Record<string, VisemeData['value']> = {
  // 元音类
  'a': 'a', '@': 'a', 'E': 'a',
  'i': 'i', 'I': 'i',
  'u': 'u', 'U': 'u',
  'e': 'e',
  'o': 'o', 'O': 'o',
  // 辅音、静音类 → 闭口
  'sil': 'sil', 'p': 'sil', 't': 'sil', 'S': 'sil', 'T': 'sil',
  'f': 'sil', 'k': 'sil', 'r': 'sil', 's': 'sil', 'd': 'sil',
  'g': 'sil', 'n': 'sil', 'm': 'sil', 'N': 'sil', 'l': 'sil',
  'w': 'a', 'W': 'u', 'Y': 'i', 'j': 'i', 'z': 'sil', 'Z': 'sil',
  'th': 'sil', 'DH': 'sil',
};

/**
 * Viseme 数据（Phase 2：用于口型同步）
 */
export interface VisemeData {
  time: number;
  value: 'a' | 'i' | 'u' | 'e' | 'o' | 'sil';
}

/**
 * 头像 Context 状态
 */
export interface AvatarContextState {
  currentAvatarId: string | null;
  avatarInfo: AvatarInfo | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * VRM 表情名
 */
export type VRMExpressionName = 'happy' | 'angry' | 'sad' | 'relaxed' | 'neutral';

/**
 * 表情混合条目（表情名与强度的配对）
 */
export interface ExpressionBlendEntry {
  name: string;
  intensity: number;
}

/**
 * 表情映射设置
 * 可通过 blend 指定多个表情的组合
 */
export interface ExpressionMapping {
  expression: VRMExpressionName;
  intensity: number;
  blend?: ExpressionBlendEntry[];
}

/**
 * EmotionState 到 VRM 表情的映射
 * angry：采用 angry + blink(0.3) 的混合来实现眯眼的愤怒表情
 */
export const EMOTION_TO_VRM_EXPRESSION: Record<EmotionState, ExpressionMapping> = {
  happy: { expression: 'happy', intensity: 1.0 },
  satisfied: { expression: 'relaxed', intensity: 0.8 },
  neutral: { expression: 'neutral', intensity: 0.0 },
  annoyed: { expression: 'angry', intensity: 0.6, blend: [{ name: 'blink', intensity: 0.15 }] },
  angry: { expression: 'angry', intensity: 1.0, blend: [{ name: 'blink', intensity: 0.3 }] },
};

/**
 * 手势类型
 */
export type GestureType = 'nod' | 'headTilt' | 'none';

/**
 * VRMAvatar 组件的属性
 */
export interface VRMAvatarProps {
  modelUrl: string;
  emotion: EmotionState;
  isSpeaking: boolean;
  visemeData?: VisemeData[];
  directEmotion?: EmotionState;
  gesture?: GestureType;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * VRMAvatarContainer 的属性
 */
export interface VRMAvatarContainerProps {
  avatarId?: string;
  avatarS3Key?: string;
  angerLevel: number;
  trustLevel: number;
  progressLevel: number;
  isSpeaking: boolean;
  directEmotion?: EmotionState;
  gesture?: GestureType;
  onEmotionChange?: (emotion: EmotionState) => void;
}
