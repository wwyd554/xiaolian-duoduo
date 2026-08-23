/**
 * 表单相关的类型定义
 */

import {
  DifficultyLevel,
  VisibilityType,
  NPCInfo,
  GoalInfo,
  MetricsInfo,
} from "./api";

/**
 * 场景创建表单的基本信息
 */
export interface ScenarioBasicInfo {
  scenarioId?: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  category: string;
  language: string;
  maxTurns?: number;
}

/**
 * 共享设置表单数据
 */
export interface SharingFormData {
  visibility: VisibilityType;
  sharedWithUsers: string[];
  guardrail: string;
}

/**
 * 场景创建表单的整体数据
 */
export interface ScenarioFormData {
  scenarioId?: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  category: string;
  language: string;
  initialMessage?: string;
  maxTurns?: number;
  npc: NPCInfo;
  initialMetrics: MetricsInfo;
  goals: GoalInfo[];
  visibility: VisibilityType;
  sharedWithUsers: string[];
  guardrail: string;
}

// 用于向后兼容的别名
export type NpcFormData = NPCInfo;
export type GoalFormData = GoalInfo;
export type InitialMetrics = MetricsInfo;
