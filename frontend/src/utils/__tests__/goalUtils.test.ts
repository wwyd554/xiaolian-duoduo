import {
  mergeGoalStatus,
  mergeGoalStatuses,
} from "../goalUtils";
import type { GoalStatus } from "../../types/index";

describe("mergeGoalStatus", () => {
  const basePrev: GoalStatus = {
    goalId: "goal-1",
    progress: 0,
    achieved: false,
  };

  it("从未达成→更新为达成", () => {
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
    };
    const result = mergeGoalStatus(basePrev, update);
    expect(result.achieved).toBe(true);
    expect(result.progress).toBe(100);
    expect(result.achievedAt).toBeInstanceOf(Date);
  });

  it("已达成的目标不会退回未达成", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: new Date("2025-01-01"),
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 30,
      achieved: false,
    };
    const result = mergeGoalStatus(prev, update);
    expect(result.achieved).toBe(true);
    expect(result.progress).toBe(100);
    // achievedAt 保持首次达成时的值
    expect(result.achievedAt).toEqual(new Date("2025-01-01"));
  });

  it("progress 不会下降（未达成时）", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 60,
      achieved: false,
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 30,
      achieved: false,
    };
    const result = mergeGoalStatus(prev, update);
    expect(result.achieved).toBe(false);
    expect(result.progress).toBe(60); // 不下降
  });

  it("progress 上升时会被更新", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 30,
      achieved: false,
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 70,
      achieved: false,
    };
    const result = mergeGoalStatus(prev, update);
    expect(result.progress).toBe(70);
  });

  it("update 中没有 progress 时保持当前值", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      achieved: false,
    };
    const result = mergeGoalStatus(prev, update);
    expect(result.progress).toBe(50);
  });

  it("achievedAt 仅在首次达成时记录", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 0,
      achieved: false,
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
    };
    const result = mergeGoalStatus(prev, update);
    expect(result.achievedAt).toBeInstanceOf(Date);

    // 第二次达成更新时 achievedAt 不变
    const firstAchievedAt = result.achievedAt;
    const result2 = mergeGoalStatus(result, {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
    });
    expect(result2.achievedAt).toEqual(firstAchievedAt);
  });

  it("reason 字段会被更新", () => {
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
      reason: "部分达成",
    };
    const result = mergeGoalStatus(basePrev, update);
    expect(result.reason).toBe("部分达成");
  });
});

describe("mergeGoalStatuses", () => {
  it("能一次合并多个目标", () => {
    const prevStatuses: GoalStatus[] = [
      { goalId: "goal-1", progress: 30, achieved: false },
      { goalId: "goal-2", progress: 0, achieved: false },
      { goalId: "goal-3", progress: 100, achieved: true, achievedAt: new Date("2025-01-01") },
    ];
    const updates: GoalStatus[] = [
      { goalId: "goal-1", progress: 70, achieved: false },
      { goalId: "goal-3", progress: 50, achieved: false }, // 已达成试图退回未达成
    ];

    const result = mergeGoalStatuses(prevStatuses, updates);

    // goal-1：progress 上升
    expect(result[0].progress).toBe(70);
    expect(result[0].achieved).toBe(false);

    // goal-2：无更新
    expect(result[1].progress).toBe(0);
    expect(result[1].achieved).toBe(false);

    // goal-3：保持达成状态
    expect(result[2].progress).toBe(100);
    expect(result[2].achieved).toBe(true);
    expect(result[2].achievedAt).toEqual(new Date("2025-01-01"));
  });

  it("空更新数组时不产生变更", () => {
    const prevStatuses: GoalStatus[] = [
      { goalId: "goal-1", progress: 50, achieved: false },
    ];
    const result = mergeGoalStatuses(prevStatuses, []);
    expect(result).toEqual(prevStatuses);
  });
});


import { serializeGoalStatus } from "../goalUtils";

describe("serializeGoalStatus", () => {
  it("将 Date 类型的 achievedAt 转换为 ISO 字符串", () => {
    const status: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: new Date("2025-06-15T10:30:00Z"),
    };
    const result = serializeGoalStatus(status);
    expect(result.achievedAt).toBe("2025-06-15T10:30:00.000Z");
    expect(typeof result.achievedAt).toBe("string");
  });

  it("字符串类型的 achievedAt 原样保留", () => {
    const status: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: "2025-06-15T10:30:00Z" as unknown as Date,
    };
    const result = serializeGoalStatus(status);
    expect(result.achievedAt).toBe("2025-06-15T10:30:00Z");
  });

  it("没有 achievedAt 时不包含该属性", () => {
    const status: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
    };
    const result = serializeGoalStatus(status);
    expect("achievedAt" in result).toBe(false);
  });

  it("undefined 不包含在对象中", () => {
    const status: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
      achievedAt: undefined,
    };
    const result = serializeGoalStatus(status);
    expect("achievedAt" in result).toBe(false);
    // 即使 JSON.stringify 也不会出现 achievedAt 键
    const json = JSON.parse(JSON.stringify(result));
    expect("achievedAt" in json).toBe(false);
  });

  it("progress 不是 number 时为 0", () => {
    const status = {
      goalId: "goal-1",
      progress: "invalid" as unknown as number,
      achieved: false,
    } as GoalStatus;
    const result = serializeGoalStatus(status);
    expect(result.progress).toBe(0);
  });

  it("achieved 为 falsy 时也会进行 Boolean 转换", () => {
    const status = {
      goalId: "goal-1",
      progress: 0,
      achieved: undefined as unknown as boolean,
    } as GoalStatus;
    const result = serializeGoalStatus(status);
    expect(result.achieved).toBe(false);
  });
});
