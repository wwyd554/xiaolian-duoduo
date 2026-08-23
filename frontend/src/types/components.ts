/**
 * 组件相关的类型定义
 */

import { ReactNode } from "react";
import { EmotionState } from "./index";
import {
  NPCInfo,
  GoalInfo,
  MetricsInfo,
  GuardrailInfo,
  VisibilityType,
} from "./api";
import { ScenarioFormData } from "./forms";

/**
 * 用于判断 IME 输入中的键盘事件类型
 */
export type CompositionEventType = React.KeyboardEvent & {
  nativeEvent: {
    isComposing: boolean;
  };
};

/**
 * 表情反馈组件的属性
 */
export interface EmojiFeedbackProps {
  // 情感指标
  angerLevel: number; // 怒气水平（0-100）
  trustLevel: number; // 信任度（0-100）
  progressLevel: number; // 进度（0-100）

  // 显示选项
  size?: "small" | "medium" | "large";
  animationEnabled?: boolean;

  // 无障碍
  announceStateChanges?: boolean;

  // 事件处理器
  onEmotionChange?: (emotion: EmotionState) => void;
}

/**
 * 情感状态的详细信息
 */
export interface EmotionDetail {
  emoji: string;
  displayName: string;
  description: string;
  colorToken: string;
}

/**
 * 步骤组件的通用属性
 */
export interface StepComponentProps {
  children?: ReactNode;
  title?: string;
  description?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
}

/**
 * 表单字段的通用属性
 */
export interface FormFieldProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * 选择选项
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * 目标设置步骤的属性
 */
export interface GoalsStepProps {
  formData: {
    initialMetrics: MetricsInfo;
    goals: GoalInfo[];
  };
  updateFormData: (
    data: Partial<{
      objectives: string[];
      initialMetrics: MetricsInfo;
      goals: GoalInfo[];
    }>,
  ) => void;
  validationErrors?: Record<string, string | null>;
}

/**
 * NPC 信息设置步骤的属性
 */
export interface NPCInfoStepProps {
  formData: {
    npc: NPCInfo;
    initialMessage?: string;
    language?: string;
  };
  updateFormData: (
    data: Partial<NPCInfo & { initialMessage?: string; voiceId?: string }>,
  ) => void;
  validationErrors?: Record<string, string | null>;
  // VRM 头像上传
  avatarFile?: File | null;
  avatarFileName?: string;
  onAvatarFileChange?: (file: File | null) => void;
  // 语音模型选择
  voiceId?: string;
  onVoiceIdChange?: (voiceId: string) => void;
  // 头像显示开/关
  enableAvatar?: boolean;
  onEnableAvatarChange?: (enabled: boolean) => void;
}

/**
 * 预览步骤的属性
 */
export interface PreviewStepProps {
  formData: ScenarioFormData & {
    guardrail?: string;
  };
}

/**
 * 共享设置步骤的属性
 */
export interface SharingStepProps {
  formData: {
    visibility: VisibilityType;
    sharedWithUsers: string[];
    guardrail?: string;
  };
  guardrailsList: GuardrailInfo[];
  updateFormData: (
    data: Partial<{
      visibility: VisibilityType;
      sharedWithUsers: string[];
      guardrail?: string;
    }>,
  ) => void;
  validationErrors?: Record<string, string | null>;
}

/**
 * 录制组件相关的类型定义
 */
export interface VideoManagerRef {
  forceStopRecording: () => Promise<void>;
}

export interface VideoRecorderRef {
  forceStopRecording: () => Promise<void>;
}
