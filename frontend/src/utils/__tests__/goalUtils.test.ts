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

  it("未達成→達成に更新される", () => {
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

  it("一度達成したゴールは未達成に戻らない", () => {
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
    // achievedAtは最初の達成時のまま
    expect(result.achievedAt).toEqual(new Date("2025-01-01"));
  });

  it("progressは下がらない（未達成時）", () => {
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
    expect(result.progress).toBe(60); // 下がらない
  });

  it("progressが上がる場合は更新される", () => {
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

  it("updateにprogressがない場合は現在値を維持する", () => {
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

  it("achievedAtは最初の達成時のみ記録される", () => {
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

    // 2回目の達成更新ではachievedAtは変わらない
    const firstAchievedAt = result.achievedAt;
    const result2 = mergeGoalStatus(result, {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
    });
    expect(result2.achievedAt).toEqual(firstAchievedAt);
  });

  it("reasonフィールドが更新される", () => {
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
      reason: "部分的に達成",
    };
    const result = mergeGoalStatus(basePrev, update);
    expect(result.reason).toBe("部分的に達成");
  });
});

describe("mergeGoalStatuses", () => {
  it("複数ゴールを一括マージできる", () => {
    const prevStatuses: GoalStatus[] = [
      { goalId: "goal-1", progress: 30, achieved: false },
      { goalId: "goal-2", progress: 0, achieved: false },
      { goalId: "goal-3", progress: 100, achieved: true, achievedAt: new Date("2025-01-01") },
    ];
    const updates: GoalStatus[] = [
      { goalId: "goal-1", progress: 70, achieved: false },
      { goalId: "goal-3", progress: 50, achieved: false }, // 達成済みが未達成に戻ろうとする
    ];

    const result = mergeGoalStatuses(prevStatuses, updates);

    // goal-1: progressが上がる
    expect(result[0].progress).toBe(70);
    expect(result[0].achieved).toBe(false);

    // goal-2: 更新なし
    expect(result[1].progress).toBe(0);
    expect(result[1].achieved).toBe(false);

    // goal-3: 達成状態を維持
    expect(result[2].progress).toBe(100);
    expect(result[2].achieved).toBe(true);
    expect(result[2].achievedAt).toEqual(new Date("2025-01-01"));
  });

  it("空の更新配列では変更なし", () => {
    const prevStatuses: GoalStatus[] = [
      { goalId: "goal-1", progress: 50, achieved: false },
    ];
    const result = mergeGoalStatuses(prevStatuses, []);
    expect(result).toEqual(prevStatuses);
  });
});


import { serializeGoalStatus } from "../goalUtils";

describe("serializeGoalStatus", () => {
  it("Date型のachievedAtをISO文字列に変換する", () => {
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

  it("文字列型のachievedAtはそのまま保持する", () => {
    const status: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: "2025-06-15T10:30:00Z" as unknown as Date,
    };
    const result = serializeGoalStatus(status);
    expect(result.achievedAt).toBe("2025-06-15T10:30:00Z");
  });

  it("achievedAtがない場合はプロパティが含まれない", () => {
    const status: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
    };
    const result = serializeGoalStatus(status);
    expect("achievedAt" in result).toBe(false);
  });

  it("undefinedがオブジェクトに含まれない", () => {
    const status: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
      achievedAt: undefined,
    };
    const result = serializeGoalStatus(status);
    expect("achievedAt" in result).toBe(false);
    // JSON.stringifyしてもachievedAtキーが出ない
    const json = JSON.parse(JSON.stringify(result));
    expect("achievedAt" in json).toBe(false);
  });

  it("progressがnumberでない場合は0になる", () => {
    const status = {
      goalId: "goal-1",
      progress: "invalid" as unknown as number,
      achieved: false,
    } as GoalStatus;
    const result = serializeGoalStatus(status);
    expect(result.progress).toBe(0);
  });

  it("achievedがfalsyでもBoolean変換される", () => {
    const status = {
      goalId: "goal-1",
      progress: 0,
      achieved: undefined as unknown as boolean,
    } as GoalStatus;
    const result = serializeGoalStatus(status);
    expect(result.achieved).toBe(false);
  });
});
