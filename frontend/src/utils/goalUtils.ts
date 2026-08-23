import type { Goal, GoalStatus, Scenario } from "../types/index";

/**
 * 从场景生成目标状态的初始状态
 * @param scenario 包含目标的场景
 * @returns 初始化后的目标状态数组
 */
export const initializeGoalStatuses = (scenario: Scenario): GoalStatus[] => {
  // goals 为空时返回空数组（objectives 为遗留字段）
  const effectiveGoals =
    scenario.goals && scenario.goals.length > 0
      ? scenario.goals
      : ((scenario as Scenario & { objectives?: string[] }).objectives || []).map((obj: string, index: number) => ({
        id: `goal-${index}`,
        description: obj,
        priority: 3,
        criteria: [] as string[],
        isRequired: index === 0,
      }));

  if (!effectiveGoals || effectiveGoals.length === 0) {
    return [];
  }

  return effectiveGoals.map((goal) => ({
    goalId: goal.id,
    progress: 0,
    achieved: false,
  }));
};

/**
 * 根据场景 ID 获取目标
 * @param scenarioId 场景 ID
 * @param scenarios 全部场景数据
 * @returns 指定场景的目标数组
 */
export const getGoalsByScenarioId = (
  scenarioId: string,
  scenarios: Scenario[],
): Goal[] => {
  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario || !scenario.goals) {
    return [];
  }
  return scenario.goals;
};

/**
 * 计算目标得分
 * @param goalStatuses 目标达成情况
 * @param goals 目标定义
 * @returns 0-100 的得分
 */
export const calculateGoalScore = (
  goalStatuses: GoalStatus[],
  goals: Goal[],
): number => {
  if (!goalStatuses.length || !goals.length) return 0;

  let totalWeight = 0;
  let weightedScore = 0;

  goals.forEach((goal) => {
    const status = goalStatuses.find((s) => s.goalId === goal.id);
    if (!status) return;

    const weight = goal.priority;
    totalWeight += weight;
    weightedScore += (status.progress / 100) * weight;
  });

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
};

/**
 * 检查所有必填目标是否均已达成
 * @param goalStatuses 目标达成情况
 * @param goals 目标定义
 * @returns 所有必填目标均达成时返回 true
 */
export const areAllRequiredGoalsAchieved = (
  goalStatuses: GoalStatus[],
  goals: Goal[],
): boolean => {
  const requiredGoals = goals.filter((g) => g.isRequired);
  if (requiredGoals.length === 0) return false;

  return requiredGoals.every((goal) => {
    const status = goalStatuses.find((s) => s.goalId === goal.id);
    return status && status.achieved;
  });
};


/**
 * 合并目标状态的更新
 *
 * 按以下规则进行合并：
 * - 已达成的目标保持达成状态（不后退）
 * - progress 不下降（保持最大值）
 * - 已达成目标的 progress 保持为 100
 * - 达成时记录 achievedAt 时间戳（仅在未设置时）
 *
 * @param prevStatus 当前目标状态
 * @param update 更新数据（部分 GoalStatus）
 * @returns 合并后的目标状态
 */
export const mergeGoalStatus = (
  prevStatus: GoalStatus,
  update: Partial<GoalStatus>,
): GoalStatus => {
  // 已达成的目标保持达成状态
  const wasAchieved = prevStatus.achieved;
  const isNowAchieved = wasAchieved || Boolean(update.achieved);

  // 确保 progress 不下降（已达成则保持 100）
  const updateProgress = typeof update.progress === "number" ? update.progress : 0;
  const newProgress = wasAchieved
    ? 100
    : Math.max(prevStatus.progress, updateProgress);

  // 从展开中排除 achievedAt，显式控制
  // 当 update 包含 achievedAt 时，防止展开意外
  // 覆盖 prevStatus 的值
  // 注意：GoalStatus 假定为普通对象。getter 和 Symbol 键不在范围内
  const restUpdate = Object.fromEntries(
    Object.entries(update).filter(([key]) => key !== "achievedAt"),
  );

  return {
    ...prevStatus,
    ...restUpdate,
    achieved: isNowAchieved,
    progress: newProgress,
    // 达成时记录时间戳（仅在未设置时）
    achievedAt:
      isNowAchieved && !prevStatus.achievedAt
        ? new Date()
        : prevStatus.achievedAt,
  };
};

/**
 * 将目标状态数组与更新数据合并
 *
 * @param prevStatuses 当前目标状态数组
 * @param updates 更新数据数组
 * @returns 合并后的目标状态数组
 */
export const mergeGoalStatuses = (
  prevStatuses: GoalStatus[],
  updates: GoalStatus[],
): GoalStatus[] => {
  return prevStatuses.map((prev) => {
    const update = updates.find((u) => u.goalId === prev.goalId);
    if (update) {
      return mergeGoalStatus(prev, update);
    }
    return prev;
  });
};


/**
 * 将 GoalStatus 序列化为 API 发送用
 *
 * 安全地进行 achievedAt 的 Date→ISO 字符串转换，
 * 防止 undefined 被包含进对象。
 *
 * @param status 目标状态
 * @returns 用于 API 发送的普通对象
 */
export const serializeGoalStatus = (
  status: GoalStatus,
): Record<string, unknown> => {
  const serialized: Record<string, unknown> = {
    goalId: status.goalId,
    achieved: Boolean(status.achieved),
    progress: typeof status.progress === "number" ? status.progress : 0,
  };

  // 仅在存在 achievedAt 时转换为 ISO 字符串并包含
  if (status.achievedAt) {
    if (status.achievedAt instanceof Date) {
      serialized.achievedAt = status.achievedAt.toISOString();
    } else if (typeof status.achievedAt === "string") {
      serialized.achievedAt = status.achievedAt;
    }
  }

  return serialized;
};
