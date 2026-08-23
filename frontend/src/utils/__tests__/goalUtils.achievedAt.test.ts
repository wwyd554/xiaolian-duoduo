/**
 * 关于 mergeGoalStatus 的 achievedAt 展开排除的测试
 *
 * 修正内容：将 update 对象的 achievedAt 从展开中排除，
 * 防止 prevStatus.achievedAt 被意外覆盖
 */
import { mergeGoalStatus } from "../goalUtils";
import type { GoalStatus } from "../../types/index";

describe("mergeGoalStatus - achievedAt 展开排除", () => {
  it("即使 update 包含 achievedAt=undefined，prevStatus 的 achievedAt 也会被保留", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: new Date("2025-06-01T00:00:00Z"),
    };
    // update 中显式包含 achievedAt: undefined 的情况
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: undefined,
    };
    const result = mergeGoalStatus(prev, update);

    // prevStatus 的 achievedAt 应被保留（不被 undefined 覆盖）
    expect(result.achievedAt).toEqual(new Date("2025-06-01T00:00:00Z"));
  });

  it("即使 update 包含 achievedAt=null，prevStatus 的 achievedAt 也会被保留", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: new Date("2025-06-01T00:00:00Z"),
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      achieved: true,
      achievedAt: null as unknown as Date,
    };
    const result = mergeGoalStatus(prev, update);

    // prevStatus 的 achievedAt 应被保留
    expect(result.achievedAt).toEqual(new Date("2025-06-01T00:00:00Z"));
  });

  it("即使 update 包含不同的 achievedAt，prevStatus 的 achievedAt 也优先", () => {
    const originalDate = new Date("2025-06-01T00:00:00Z");
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: originalDate,
    };
    // 包含不同日期时间的 achievedAt 的 update
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      achieved: true,
      achievedAt: new Date("2025-07-01T00:00:00Z"),
    };
    const result = mergeGoalStatus(prev, update);

    // 首次达成时刻应被保留（不被后来的日期时间覆盖）
    expect(result.achievedAt).toEqual(originalDate);
  });

  it("prevStatus 没有 achievedAt 且 update 中达成时，会设置新的 Date", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      // 即使 update 包含 achievedAt，因 prevStatus 中没有，所以会新建
      achievedAt: new Date("2025-07-01T00:00:00Z"),
    };
    const result = mergeGoalStatus(prev, update);

    // 应设置新的 Date（不是 update 的 achievedAt，而是 new Date()）
    expect(result.achievedAt).toBeInstanceOf(Date);
    // 应为测试执行时接近当前时刻的值，而非 update 的日期时间
    const now = new Date();
    const diff = Math.abs(now.getTime() - (result.achievedAt as Date).getTime());
    expect(diff).toBeLessThan(1000); // 1秒以内
  });

  it("update 中 achievedAt 之外的字段（如 reason 等）会正常合并", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
      reason: "初始理由",
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 80,
      achieved: true,
      reason: "更新后的理由",
      achievedAt: new Date("2025-07-01T00:00:00Z"), // 这会被忽略
    };
    const result = mergeGoalStatus(prev, update);

    // achievedAt 之外的字段会正常合并
    expect(result.reason).toBe("更新后的理由");
    expect(result.progress).toBe(80);
    expect(result.achieved).toBe(true);
    expect(result.goalId).toBe("goal-1");
  });

  it("连续合并时 achievedAt 保持一致", () => {
    // 初始状态
    const initial: GoalStatus = {
      goalId: "goal-1",
      progress: 0,
      achieved: false,
    };

    // 第 1 次：达成
    const result1 = mergeGoalStatus(initial, {
      progress: 100,
      achieved: true,
    });
    const firstAchievedAt = result1.achievedAt;
    expect(firstAchievedAt).toBeInstanceOf(Date);

    // 第 2 次：试图退回未达成（包含 achievedAt: undefined）
    const result2 = mergeGoalStatus(result1, {
      progress: 30,
      achieved: false,
      achievedAt: undefined,
    });
    expect(result2.achievedAt).toEqual(firstAchievedAt);
    expect(result2.achieved).toBe(true); // 达成状态也保持

    // 第 3 次：尝试用另一个 achievedAt 覆盖
    const result3 = mergeGoalStatus(result2, {
      progress: 100,
      achieved: true,
      achievedAt: new Date("2099-01-01T00:00:00Z"),
    });
    expect(result3.achievedAt).toEqual(firstAchievedAt); // 保持最初的值
  });
});
