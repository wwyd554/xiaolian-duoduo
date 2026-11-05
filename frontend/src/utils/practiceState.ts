import type { GoalStatus } from "../types/index";

export type PracticeTerminationReason = "user_ended" | "goals_achieved" | "max_turns" | "legacy_completed";

export function practiceEndLabel(reason: PracticeTerminationReason): string {
  return {
    user_ended: "用户主动结束陪练",
    goals_achieved: "必需训练目标已达成",
    max_turns: "已达到本场练习轮次上限",
    legacy_completed: "本场练习已结束",
  }[reason];
}

/** Server decisions replace local status, including revocation of mistaken achievements. */
export function applyAuthoritativeGoals(previous: GoalStatus[], updates: GoalStatus[]): GoalStatus[] {
  const old = new Map(previous.map((goal) => [goal.goalId, goal]));
  return updates.map((goal) => ({
    ...goal,
    progress: goal.achieved ? 100 : goal.progress,
    achievedAt: goal.achieved ? old.get(goal.goalId)?.achievedAt || goal.achievedAt || new Date() : undefined,
  }));
}
