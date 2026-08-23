/**
 * 后端响应转换工具
 *
 * 由于后端（Python）以 snake_case 返回响应，
 * 因此提供转换为前端（TypeScript camelCase）的函数组。
 */

import type {
  ComplianceViolation,
  ComplianceCheck,
  ImportStats,
  ImportResponse,
  AnalysisFeedbackItem,
  VideoAnalysisResult,
} from "../types/api";

// ============================================================
// 后端原始数据类型（snake_case）
// ============================================================

/** 后端返回的 ComplianceViolation 原始数据类型 */
interface RawComplianceViolation {
  rule_id: string;
  rule_name: string;
  severity: string;
  message: string;
  context: string;
  confidence: number;
  rule_name_key?: string;
  rule_name_params?: Record<string, string | number>;
  message_key?: string;
  message_params?: Record<string, string | number>;
}

/** 后端返回的 ImportStats 原始数据类型 */
interface RawImportStats {
  imported_scenarios: number;
  updated_scenarios: number;
  imported_npcs: number;
  updated_npcs: number;
  errors: number;
}

/** 后端返回的 ComplianceCheck 原始数据类型 */
interface RawComplianceCheck {
  score?: number;
  passed?: boolean;
  violations?: RawComplianceViolation[];
  risk_level?: string;
  analysis?: string;
  recommendations?: string[];
}

/** 后端返回的 ImportResponse 原始数据类型 */
interface RawImportResponse {
  success: boolean;
  message?: string;
  stats?: RawImportStats;
  errors?: string[];
  importedScenarios?: number;
  updatedScenarios?: number;
}

/** 后端返回的 VideoAnalysisResult 原始数据类型 */
interface RawVideoAnalysisResult {
  overallScore: number;
  eyeContact: number;
  facialExpression: number;
  gesture: number;
  emotion: number;
  strengths: (AnalysisFeedbackItem | string)[];
  improvements: (AnalysisFeedbackItem | string)[];
  analysis: string;
}

// ============================================================
// 変換関数
// ============================================================

/**
 * 将后端的 ComplianceViolation（snake_case）转换为前端类型（camelCase）
 */
export function transformComplianceViolation(
  raw: RawComplianceViolation,
): ComplianceViolation {
  return {
    ruleId: raw.rule_id,
    ruleName: raw.rule_name,
    severity: raw.severity as ComplianceViolation["severity"],
    message: raw.message,
    context: raw.context,
    confidence: raw.confidence,
    ruleNameKey: raw.rule_name_key,
    ruleNameParams: raw.rule_name_params,
    messageKey: raw.message_key,
    messageParams: raw.message_params,
  };
}

/**
 * 转换 ComplianceCheck 内的 violations 数组
 * 同时接受后端的 snake_case 形式或前端形式
 */
export function transformComplianceCheck(
  raw: RawComplianceCheck | ComplianceCheck | undefined,
): ComplianceCheck | undefined {
  if (!raw) return undefined;

  // 已是前端类型（camelCase）时，仅规范化 violations 并返回
  if ('riskLevel' in raw || ('violations' in raw && Array.isArray(raw.violations) && raw.violations.length > 0 && 'ruleId' in raw.violations[0])) {
    return raw as ComplianceCheck;
  }

  // 后端类型（snake_case）时进行转换
  const rawCheck = raw as RawComplianceCheck;
  return {
    score: rawCheck.score ?? 0,
    passed: rawCheck.passed,
    violations: Array.isArray(rawCheck.violations)
      ? rawCheck.violations.map(transformComplianceViolation)
      : [],
    riskLevel: rawCheck.risk_level as ComplianceCheck['riskLevel'],
    analysis: rawCheck.analysis ?? '',
    recommendations: rawCheck.recommendations,
  };
}

/**
 * 将后端的 ImportStats（snake_case）转换为前端类型（camelCase）
 */
export function transformImportStats(raw: RawImportStats): ImportStats {
  return {
    importedScenarios: raw.imported_scenarios,
    updatedScenarios: raw.updated_scenarios,
    importedNpcs: raw.imported_npcs,
    updatedNpcs: raw.updated_npcs,
    errors: raw.errors,
  };
}

/**
 * 转换 ImportResponse 内的 stats
 * 同时接受后端的 snake_case 形式或前端形式
 */
export function transformImportResponse(
  raw: RawImportResponse | ImportResponse,
): ImportResponse {
  // 已是前端类型时直接返回
  if (raw.stats && 'importedScenarios' in raw.stats) {
    return raw as ImportResponse;
  }

  // 后端类型时进行转换
  const rawResp = raw as RawImportResponse;
  return {
    success: rawResp.success,
    stats: rawResp.stats ? transformImportStats(rawResp.stats) : { importedScenarios: 0, updatedScenarios: 0, importedNpcs: 0, updatedNpcs: 0, errors: 0 },
  };
}

/**
 * 规范化 VideoAnalysisResult 的 strengths/improvements
 * 将旧格式（string[]）转换为 AnalysisFeedbackItem[]
 */
export function normalizeAnalysisItems(
  items: (AnalysisFeedbackItem | string)[] | undefined,
): AnalysisFeedbackItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    typeof item === "string" ? { title: item, description: "" } : item,
  );
}

/**
 * 规范化 VideoAnalysisResult 的 strengths/improvements
 */
export function transformVideoAnalysisResult(
  raw: RawVideoAnalysisResult | VideoAnalysisResult | undefined,
): VideoAnalysisResult | undefined {
  if (!raw) return undefined;
  return {
    overallScore: raw.overallScore,
    eyeContact: raw.eyeContact,
    facialExpression: raw.facialExpression,
    gesture: raw.gesture,
    emotion: raw.emotion,
    analysis: raw.analysis,
    strengths: normalizeAnalysisItems(raw.strengths),
    improvements: normalizeAnalysisItems(raw.improvements),
  };
}

/**
 * 安全地将指标字符串值转换为 number
 * 为 NaN/Infinity/undefined/null 时返回默认值
 */
export function safeParseMetric(
  value: string | number | undefined | null,
  defaultValue: number = 0,
  min: number = 0,
  max: number = 10,
): number {
  if (value === undefined || value === null) return defaultValue;
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}
