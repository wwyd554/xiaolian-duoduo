// 重新导出 API 类型定义
export * from "./api";

// 导出新的类型定义
export * from "./forms";
export * from "./components";

// 显式 import（为避免循环引用）
import type {
  DifficultyLevel,
  ComplianceViolation,
  ComplianceCheck,
  NPCInfo,
  GoalInfo,
  MetricsInfo,
} from "./api";

// 场景信息（前端用）
export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  industry: string;
  initialMessage?: string; // 各场景的初始消息
  language?: string; // 场景的语言（ja|en）
  npc: NPCInfo;
  initialMetrics: ExtendedMetrics;
  goals: GoalInfo[]; // 场景的目标列表
  maxTurns?: number; // 最大对话轮数（未指定时使用默认值）
  enableAvatar?: boolean; // 头像显示开/关（未设置时为 false）
  suggestionEnabled?: boolean; // 建议回复按钮的启用/禁用（未设置时为 false）
  initialSuggestions?: string[]; // 商谈开始时显示的初次建议回复候选
}

// 扩展指标（带详细得分）
export interface ExtendedMetrics extends MetricsInfo {
  angerChange?: number; // 变化量
  trustChange?: number; // 变化量
  progressChange?: number; // 变化量

  // 详细得分
  communicationScore?: number; // 沟通技巧（1-10）
  needsAnalysisScore?: number; // 需求分析能力（1-10）
  proposalQualityScore?: number; // 提案质量（1-10）
  flexibilityScore?: number; // 灵活性（1-10）
  trustBuildingScore?: number; // 信任建立（1-10）
  objectionHandlingScore?: number; // 异议应对能力（1-10）
  closingSkillScore?: number; // 成交技巧（1-10）
  listeningSkillScore?: number; // 倾听技巧（1-10）
  productKnowledgeScore?: number; // 产品知识（1-10）
  customerFocusScore?: number; // 客户中心思维（1-10）
  analysis?: string; // 简洁的分析文本
}

// 消息
export interface Message {
  id: string;
  sender: "user" | "npc";
  content: string;
  timestamp: Date;
  metrics?: ExtendedMetrics;
  compliance?: ComplianceCheck;
  /** 发送此消息时选中的幻灯片页码列表 */
  presentedSlides?: number[];
}

// 会话信息
export interface Session {
  id: string;
  scenarioId: string;
  startTime: Date;
  endTime?: Date;
  messages: Message[];
  finalMetrics: ExtendedMetrics;
  finalScore: number;
  feedback: string[];
  goalStatuses: GoalStatus[]; // 目标达成情况
  goalScore: number; // 目标得分（0-100）
  complianceViolations?: ComplianceViolation[]; // 合规违规列表
  endReason?: string; // 会话结束原因
}

// 对话响应模式
export interface ResponsePattern {
  keywords: string[];
  responses: string[];
  metricsChange: Partial<ExtendedMetrics>;
  conditions?: {
    minTrust?: number;
    maxAnger?: number;
    minProgress?: number;
  };
}

// 对话规则
export interface DialogueRule {
  trigger: string[];
  response: string;
  metricsChange: Partial<ExtendedMetrics>;
  priority: number;
}

// 目标达成情况
export interface GoalStatus {
  goalId: string; // 目标 ID
  progress: number; // 进度（0-100%）
  achieved: boolean; // 是否已达成
  achievedAt?: Date; // 达成时间
  reason?: string; // 达成/未达成的理由
}

// 情感状态
export type EmotionState =
  | "angry"
  | "annoyed"
  | "neutral"
  | "satisfied"
  | "happy";

// 用于情感状态计算的参数
export interface EmotionCalculationParams {
  angerLevel: number;
  trustLevel: number;
  progressLevel: number;
  previousEmotion?: EmotionState;
}

// 用于向后兼容的别名
export type NPC = NPCInfo;
export type Goal = GoalInfo;
export type Metrics = ExtendedMetrics;
