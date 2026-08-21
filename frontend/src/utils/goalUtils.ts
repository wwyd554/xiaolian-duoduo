import type { Goal, GoalStatus, Scenario } from "../types/index";

/**
 * シナリオからゴールステータスの初期状態を生成する
 * @param scenario ゴールを含むシナリオ
 * @returns 初期化されたゴールステータスの配列
 */
export const initializeGoalStatuses = (scenario: Scenario): GoalStatus[] => {
  // goalsが空の場合は空配列を返す（objectivesはレガシーフィールド）
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
 * シナリオIDに基づいてゴールを取得する
 * @param scenarioId シナリオID
 * @param scenarios 全シナリオデータ
 * @returns 指定されたシナリオのゴール配列
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
 * ゴールスコアを計算する
 * @param goalStatuses ゴール達成状況
 * @param goals ゴール定義
 * @returns 0-100のスコア
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
 * 必須ゴールがすべて達成されたかチェックする
 * @param goalStatuses ゴール達成状況
 * @param goals ゴール定義
 * @returns すべての必須ゴールが達成された場合true
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
 * ゴールステータスの更新をマージする
 *
 * 以下のルールに従ってマージする:
 * - 一度達成したゴールは達成状態を維持する（後退しない）
 * - progressは下がらない（最大値を維持する）
 * - 達成済みゴールのprogressは100を維持する
 * - 達成時にachievedAtタイムスタンプを記録する（未設定の場合のみ）
 *
 * @param prevStatus 現在のゴールステータス
 * @param update 更新データ（部分的なGoalStatus）
 * @returns マージされたゴールステータス
 */
export const mergeGoalStatus = (
  prevStatus: GoalStatus,
  update: Partial<GoalStatus>,
): GoalStatus => {
  // 一度達成したゴールは達成状態を維持する
  const wasAchieved = prevStatus.achieved;
  const isNowAchieved = wasAchieved || Boolean(update.achieved);

  // progressは下がらないようにする（達成済みなら100を維持）
  const updateProgress = typeof update.progress === "number" ? update.progress : 0;
  const newProgress = wasAchieved
    ? 100
    : Math.max(prevStatus.progress, updateProgress);

  // achievedAtはスプレッドから除外し、明示的に制御する
  // updateにachievedAtが含まれている場合、スプレッドでprevStatusの値が
  // 意図せず上書きされることを防ぐ
  // 注意: GoalStatusはプレーンオブジェクト前提。ゲッターやSymbolキーは対象外
  const restUpdate = Object.fromEntries(
    Object.entries(update).filter(([key]) => key !== "achievedAt"),
  );

  return {
    ...prevStatus,
    ...restUpdate,
    achieved: isNowAchieved,
    progress: newProgress,
    // 達成時にタイムスタンプを記録（未設定の場合のみ）
    achievedAt:
      isNowAchieved && !prevStatus.achievedAt
        ? new Date()
        : prevStatus.achievedAt,
  };
};

/**
 * ゴールステータス配列を更新データとマージする
 *
 * @param prevStatuses 現在のゴールステータス配列
 * @param updates 更新データの配列
 * @returns マージされたゴールステータス配列
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
 * GoalStatusをAPI送信用にシリアライズする
 *
 * achievedAtのDate→ISO文字列変換を安全に行い、
 * undefinedがオブジェクトに含まれることを防ぐ。
 *
 * @param status ゴールステータス
 * @returns API送信用のプレーンオブジェクト
 */
export const serializeGoalStatus = (
  status: GoalStatus,
): Record<string, unknown> => {
  const serialized: Record<string, unknown> = {
    goalId: status.goalId,
    achieved: Boolean(status.achieved),
    progress: typeof status.progress === "number" ? status.progress : 0,
  };

  // achievedAtがある場合のみISO文字列に変換して含める
  if (status.achievedAt) {
    if (status.achievedAt instanceof Date) {
      serialized.achievedAt = status.achievedAt.toISOString();
    } else if (typeof status.achievedAt === "string") {
      serialized.achievedAt = status.achievedAt;
    }
  }

  return serialized;
};
