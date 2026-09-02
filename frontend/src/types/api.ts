/**
 * API 相关的类型定义
 *
 * 设计方针：
 * - 前端类型始终表示已解析的值（统一为 number 类型）
 * - 兼容旧接口的 string 型指标等数据用 SessionCompleteDataResponse 表示，
 *   在 API 服务层转换为前端用的类型（number 型等）
 * - 将共通概念（状态、sender 等）抽取为 type alias，消除重复
 * - 以 MetricsInfo 为基本类型，在所有指标相关字段中复用
 */

// ============================================================
// 通用 type alias
// ============================================================

/** 难度等级 */
export type DifficultyLevel = "easy" | "normal" | "hard" | "expert";

/** 公开设置 */
export type VisibilityType = "public" | "private" | "shared";

/** 会话状态 */
export type SessionStatus = "active" | "completed" | "archived" | "abandoned";

/** 消息发送者 */
export type SenderType = "user" | "npc" | "system";

/** 合规严重程度 */
export type ComplianceSeverity = "high" | "medium" | "low";

/** 提案资料转换状态 */
export type PresentationStatus = "uploading" | "converting" | "ready" | "error";

/** 允许的文件 MIME 类型 */
export type AllowedContentType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

// ============================================================
// 基本类型
// ============================================================

/**
 * NPC 信息的基本类型
 */
export interface NPCInfo {
  id?: string;
  name: string;
  role: string;
  company: string;
  personality: string[];
  avatar?: string;
  description: string;
  voiceId?: string;
}

/**
 * 目标信息的基本类型
 */
export interface GoalInfo {
  id: string;
  description: string;
  /** 达成目标的提示（多个） */
  hints?: string[];
  isRequired: boolean;
  priority: number;
  criteria: string[];
}

/**
 * 指标信息的基本类型
 * 用作所有指标相关字段的基类型
 */
export interface MetricsInfo {
  /** 怒气水平（0-10 范围） */
  angerLevel: number;
  /** 信任度（0-10 范围） */
  trustLevel: number;
  /** 进度（0-10 范围） */
  progressLevel: number;
}

/**
 * 带分析文本的指标
 */
export interface MetricsWithAnalysis extends MetricsInfo {
  analysis?: string;
}

/**
 * Guardrail 信息的基本类型
 */
export interface GuardrailInfo {
  id: string;
  name: string;
  description: string;
}

// ============================================================
// 合规相关
// ============================================================

/**
 * 合规违规的类型
 * 前端类型统一为 camelCase。
 * 在 API 客户端层完成后端（Python snake_case）数据的转换。
 */
export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  severity: ComplianceSeverity;
  message: string;
  /** @security 包含用户输入。显示时应以文本节点渲染，禁止直接插入 innerHTML/href 等 */
  context: string;
  confidence: number;
  // i18n 翻译键支持
  ruleNameKey?: string;
  ruleNameParams?: Record<string, string | number>;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
}

/**
 * 合规检查结果的类型
 */
export interface ComplianceCheck {
  score: number;
  passed?: boolean;
  violations: ComplianceViolation[];
  riskLevel?: ComplianceSeverity;
  analysis: string;
  recommendations?: string[];
  processingTimeMs?: number;
}

// ============================================================
// 目标达成情况
// ============================================================

/**
 * API 响应用的目标达成情况
 * 在 RealtimeMetric、SessionCompleteDataResponse 等中通用
 */
export interface ApiGoalStatus {
  goalId: string;
  achieved: boolean;
  achievedAt?: string | null;
  progress: number;
}

// ============================================================
// 实时指标
// ============================================================

/**
 * 实时指标类型
 * 前端始终按 number 类型处理
 */
export interface RealtimeMetric extends MetricsWithAnalysis {
  goalStatuses?: ApiGoalStatus[];
  goalScore?: number;
  messageNumber?: number;
  timestamp?: string;
  userMessage?: string;
  compliance?: ComplianceCheck;
}

// ============================================================
// 反馈分析
// ============================================================

/**
 * 反馈得分
 */
export interface FeedbackScores {
  overall: number;
  communication: number;
  needsAnalysis: number;
  proposalQuality: number;
  flexibility: number;
  trustBuilding: number;
  objectionHandling: number;
  closingSkill: number;
  listeningSkill: number;
  productKnowledge: number;
  customerFocus: number;
  goalAchievement: number;
}

/**
 * 目标反馈
 */
export interface GoalFeedback {
  achievedGoals: string[];
  partiallyAchievedGoals: string[];
  missedGoals: string[];
  recommendations: string[];
}

/**
 * 详细分析
 */
export interface DetailedAnalysis {
  communicationPatterns: {
    questionFrequency: number;
    responseQuality: number;
    clarityOfExplanation: number;
  };
  customerInteraction: {
    empathyLevel: number;
    respectShown: number;
    engagementQuality: number;
  };
  salesTechniques: {
    valuePropositionClarity: number;
    needsAlignment: number;
    painPointIdentification: number;
  };
}

/**
 * 反馈分析的响应类型
 */
export interface FeedbackAnalysisResult {
  scores: FeedbackScores;
  strengths: string[];
  improvements: string[];
  keyInsights: string[];
  nextSteps: string;
  videoAnalysis?: VideoAnalysisResult;
  videoAnalysisCreatedAt?: string;
  goalFeedback?: GoalFeedback;
  detailedAnalysis?: DetailedAnalysis;
}

// ============================================================
// 会话相关
// ============================================================

/**
 * 会话信息的类型
 */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  scenarioId: string;
  scenarioName?: string;
  title?: string;
  status: SessionStatus;
  createdAt?: string;
  updatedAt?: string;
  startTime?: string;
  endTime?: string;
  messageCount?: number;
  npcInfo?: {
    name: string;
    role: string;
    company: string;
    personality?: string[];
  };
  metrics?: MetricsInfo;
  scores?: {
    overall: number;
    communication: number;
    trustBuilding: number;
  };
  complianceViolations?: ComplianceViolation[];
  duration?: number;
  lastActivityTime?: string;
  expirationTime?: number;
}

// ============================================================
// 消息相关
// ============================================================

/**
 * 消息信息的类型
 */
export interface MessageInfo {
  messageId: string;
  sessionId: string;
  userId?: string;
  timestamp: string;
  sender: SenderType;
  content: string;
  realtimeMetrics?: MetricsWithAnalysis;
  compliance?: ComplianceCheck;
  audioUrl?: string;
  expirationTime?: number;
}

// ============================================================
// 文件相关
// ============================================================

/**
 * 文件信息的基础类型
 */
export interface FileInfo {
  key: string;
  fileName: string;
  contentType: AllowedContentType | string;
  size?: number;
}

/**
 * PDF 文件信息
 */
export type PdfFileInfo = FileInfo;

/**
 * 幻灯片图片信息（PDF→图片转换后的各页）
 */
export interface SlideImageInfo {
  pageNumber: number;
  imageKey: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

/**
 * 提案资料信息
 */
export interface PresentationFileInfo extends FileInfo {
  totalPages?: number;
  slides?: SlideImageInfo[];
  status?: PresentationStatus;
}

// ============================================================
// 场景相关
// ============================================================

/**
 * 场景信息的类型
 */
export interface ScenarioInfo {
  scenarioId: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  category: string;
  industry?: string;
  initialMessage?: string;
  language?: string;
  estimatedDuration?: number;
  maxTurns?: number;
  goals?: GoalInfo[];
  /** NPC 信息（创建、更新时使用） */
  npc?: {
    name: string;
    role: string;
    company: string;
    personality?: string[];
    description?: string;
    voiceId?: string;
    avatar?: string;
    id?: string;
  };
  npcInfo?: NPCInfo;
  initialMetrics?: Partial<MetricsInfo>;
  objectives?: string[];
  tags?: string[];
  createdBy?: string;
  isCustom?: boolean;
  visibility?: VisibilityType;
  sharedWithUsers?: string[];
  guardrail?: string;
  createdAt?: string;
  updatedAt?: string;
  pdfFiles?: PdfFileInfo[];
  presentationFile?: PresentationFileInfo;
  avatarId?: string;
  enableAvatar?: boolean;
  /** 建议回复按钮的启用/禁用（未设置时为 false） */
  suggestionEnabled?: boolean;
  /** 商谈开始时显示的初次建议回复候选（用于用户首次输入前） */
  initialSuggestions?: string[];
}

// ============================================================
// 列表响应
// ============================================================

/**
 * 会话列表的响应类型
 */
export interface SessionListResponse {
  sessions: SessionInfo[];
  nextToken?: string;
  totalCount?: number;
}

/**
 * 消息列表的响应类型
 */
export interface MessageListResponse {
  messages: MessageInfo[];
  nextToken?: string;
}

/**
 * 场景列表的响应类型
 */
export interface ScenarioListResponse {
  scenarios: ScenarioInfo[];
  nextToken?: string;
}

// ============================================================
// API 通用响应
// ============================================================

/**
 * API 通用响应类型
 * ※ feedback 字段为向后兼容而保留。新 API 请使用 data
 */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ============================================================
// 视频分析
// ============================================================

/**
 * 分析反馈条目（优点、改进点）
 */
export interface AnalysisFeedbackItem {
  title: string;
  description: string;
}

/**
 * 视频分析结果的类型定义
 * strengths/improvements 统一为结构化类型。
 * 旧格式（string[]）的转换在 API 客户端层完成。
 */
export interface VideoAnalysisResult {
  eyeContact: number;
  facialExpression: number;
  gesture: number;
  emotion: number;
  overallScore: number;
  strengths: AnalysisFeedbackItem[];
  improvements: AnalysisFeedbackItem[];
  analysis: string;
  videoUrl?: string;
}

// ============================================================
// 参考资料核查
// ============================================================

/**
 * 参考资料核查的评估分类
 * - "appropriate"    : 发言符合参考资料内容，提供了准确信息
 * - "issue"          : 发言与参考资料内容矛盾，或包含错误信息
 * - "not_applicable" : 问候、一般进程、表态等无法判断参考资料正误的发言
 */
export type ReferenceCheckEvaluation =
  | "appropriate"
  | "issue"
  | "not_applicable";

/**
 * 参考资料核查的消息信息
 */
export interface ReferenceCheckMessage {
  message: string;
  relatedDocument?: string;
  reviewComment?: string;
  /** 评估分类（3 类） */
  evaluation: ReferenceCheckEvaluation;
}

/**
 * 参考资料核查的汇总信息
 */
export interface ReferenceCheckSummary {
  totalMessages: number;
  checkedMessages: number;
  /** 恰当发言数 */
  appropriateCount?: number;
  /** 评估范围外的发言数 */
  notApplicableCount?: number;
  /** 有问题的发言数 */
  issueCount?: number;
}

/**
 * 参考资料核查结果的类型
 */
export interface ReferenceCheckResult {
  messages: ReferenceCheckMessage[];
  summary: ReferenceCheckSummary;
}

// ============================================================
// 导出/导入
// ============================================================

/**
 * 场景导出/导入用的类型定义
 */
export interface ScenarioExportData {
  npcs: NPCInfo[];
  scenarios: ScenarioInfo[];
  exportedAt?: string;
  exportedBy?: string;
  version?: string;
}

/**
 * 导入统计信息的类型
 * 前端类型统一为 camelCase。
 * 在 API 客户端层完成后端（Python snake_case）数据的转换。
 */
export interface ImportStats {
  importedScenarios: number;
  updatedScenarios: number;
  importedNpcs: number;
  updatedNpcs: number;
  errors: number;
}

/**
 * 导入响应的类型
 */
export interface ImportResponse {
  success: boolean;
  stats: ImportStats;
  details?: {
    importedScenarios: Array<{
      originalId?: string;
      newId: string;
      title: string;
    }>;
    skippedScenarios: Array<{
      originalId?: string;
      title?: string;
      reason: string;
    }>;
    errors: Array<{
      scenario: string;
      error: string;
    }>;
  };
}

// ============================================================
// 会话完整数据（兼容旧接口数据）
// ============================================================

/**
 * 旧接口数据使用的指标类型（string 版）。
 */
export interface RawMetricsInfo {
  angerLevel: string;
  trustLevel: string;
  progressLevel: string;
}

/**
 * 旧接口数据使用的指标类型（带分析文本）
 */
export interface RawMetricsWithAnalysis extends RawMetricsInfo {
  analysis: string;
}

/**
 * 旧接口数据使用的目标达成情况
 */
export interface RawGoalStatus {
  goalId: string;
  achieved: boolean;
  achievedAt: string | null;
  progress: string;
}

/**
 * 会话完整数据的 API 响应类型定义
 *
 * 表示旧接口返回的完整会话数据类型。
 * 指标值定义为 string 类型。
 * 前端使用时请用 safeParseMetric() 安全转换。
 */
export interface SessionCompleteDataResponse {
  success: boolean;
  sessionId: string;
  sessionInfo: {
    sessionId: string;
    userId: string;
    scenarioId: string;
    status: SessionStatus;
    createdAt: string;
    updatedAt: string;
    title?: string;
    npcInfo?: Pick<NPCInfo, "name" | "role" | "company"> & {
      personality: string[];
    };
  };
  messages: Array<{
    messageId: string;
    sessionId: string;
    userId: string;
    sender: SenderType;
    content: string;
    timestamp: string;
    realtimeMetrics?: RawMetricsInfo;
    presentedSlides?: number[];
  }>;
  realtimeMetrics: Array<{
    sessionId: string;
    messageNumber: string;
    dataType: string;
    userMessage: string;
    analysis: string;
    goalScore: string;
    goalStatuses: RawGoalStatus[];
    createdAt: string;
  } & RawMetricsInfo>;
  complianceViolations: ComplianceViolation[];
  videoAnalysis?: VideoAnalysisResult;
  videoAnalysisCreatedAt?: string;
  videoUrl?: string;
  createdAt?: string;
  feedback?: FeedbackAnalysisResult;
  finalMetrics?: RawMetricsWithAnalysis;
  feedbackCreatedAt?: string;
  goalResults?: {
    scenarioGoals: Array<{
      id: string;
      description: string;
      isRequired: boolean;
      priority: string;
      criteria: string[];
    }>;
    goalStatuses: RawGoalStatus[];
    goalScore: number;
  };
  referenceCheck?: ReferenceCheckResult;
  referenceCheckCreatedAt?: string;
}
