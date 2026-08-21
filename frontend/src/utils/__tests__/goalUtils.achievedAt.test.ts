/**
 * mergeGoalStatus の achievedAt スプレッド除外に関するテスト
 *
 * 修正内容: update オブジェクトの achievedAt をスプレッドから除外し、
 * prevStatus.achievedAt が意図せず上書きされることを防ぐ
 */
import { mergeGoalStatus } from "../goalUtils";
import type { GoalStatus } from "../../types/index";

describe("mergeGoalStatus - achievedAt スプレッド除外", () => {
  it("updateにachievedAt=undefinedが含まれていてもprevStatusのachievedAtが保持される", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: new Date("2025-06-01T00:00:00Z"),
    };
    // updateにachievedAt: undefinedが明示的に含まれるケース
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: undefined,
    };
    const result = mergeGoalStatus(prev, update);

    // prevStatusのachievedAtが保持されること（undefinedで上書きされない）
    expect(result.achievedAt).toEqual(new Date("2025-06-01T00:00:00Z"));
  });

  it("updateにachievedAt=nullが含まれていてもprevStatusのachievedAtが保持される", () => {
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

    // prevStatusのachievedAtが保持されること
    expect(result.achievedAt).toEqual(new Date("2025-06-01T00:00:00Z"));
  });

  it("updateに異なるachievedAtが含まれていてもprevStatusのachievedAtが優先される", () => {
    const originalDate = new Date("2025-06-01T00:00:00Z");
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      achievedAt: originalDate,
    };
    // 異なる日時のachievedAtを含むupdate
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      achieved: true,
      achievedAt: new Date("2025-07-01T00:00:00Z"),
    };
    const result = mergeGoalStatus(prev, update);

    // 最初の達成時刻が保持されること（後から来た日時で上書きされない）
    expect(result.achievedAt).toEqual(originalDate);
  });

  it("prevStatusにachievedAtがなく、updateで達成された場合は新しいDateが設定される", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 100,
      achieved: true,
      // updateにachievedAtが含まれていても、prevStatusにないので新規生成される
      achievedAt: new Date("2025-07-01T00:00:00Z"),
    };
    const result = mergeGoalStatus(prev, update);

    // 新しいDateが設定されること（updateのachievedAtではなく、new Date()）
    expect(result.achievedAt).toBeInstanceOf(Date);
    // updateの日時ではなく、テスト実行時の現在時刻に近い値であること
    const now = new Date();
    const diff = Math.abs(now.getTime() - (result.achievedAt as Date).getTime());
    expect(diff).toBeLessThan(1000); // 1秒以内
  });

  it("updateのachievedAt以外のフィールド（reason等）は正常にマージされる", () => {
    const prev: GoalStatus = {
      goalId: "goal-1",
      progress: 50,
      achieved: false,
      reason: "初期理由",
    };
    const update: Partial<GoalStatus> = {
      goalId: "goal-1",
      progress: 80,
      achieved: true,
      reason: "更新された理由",
      achievedAt: new Date("2025-07-01T00:00:00Z"), // これは無視される
    };
    const result = mergeGoalStatus(prev, update);

    // achievedAt以外のフィールドは正常にマージされる
    expect(result.reason).toBe("更新された理由");
    expect(result.progress).toBe(80);
    expect(result.achieved).toBe(true);
    expect(result.goalId).toBe("goal-1");
  });

  it("連続マージでachievedAtが一貫して保持される", () => {
    // 初期状態
    const initial: GoalStatus = {
      goalId: "goal-1",
      progress: 0,
      achieved: false,
    };

    // 1回目: 達成
    const result1 = mergeGoalStatus(initial, {
      progress: 100,
      achieved: true,
    });
    const firstAchievedAt = result1.achievedAt;
    expect(firstAchievedAt).toBeInstanceOf(Date);

    // 2回目: 未達成に戻そうとする（achievedAt: undefinedを含む）
    const result2 = mergeGoalStatus(result1, {
      progress: 30,
      achieved: false,
      achievedAt: undefined,
    });
    expect(result2.achievedAt).toEqual(firstAchievedAt);
    expect(result2.achieved).toBe(true); // 達成状態も維持

    // 3回目: 別のachievedAtで上書きしようとする
    const result3 = mergeGoalStatus(result2, {
      progress: 100,
      achieved: true,
      achievedAt: new Date("2099-01-01T00:00:00Z"),
    });
    expect(result3.achievedAt).toEqual(firstAchievedAt); // 最初の値を維持
  });
});
