import { applyAuthoritativeGoals, practiceEndLabel } from "../../utils/practiceState";

test("backend revocation clears achievement and timestamp", () => {
  const old = [{ goalId: "g", achieved: true, progress: 100, achievedAt: new Date() }];
  const result = applyAuthoritativeGoals(old, [{ goalId: "g", achieved: false, progress: 0, reason: "证据不足" }]);
  expect(result[0]).toMatchObject({ achieved: false, progress: 0, reason: "证据不足" });
  expect(result[0].achievedAt).toBeUndefined();
  expect(old[0].achieved).toBe(true);
});

test("valid existing achievement keeps its timestamp", () => {
  const when = new Date("2026-01-01");
  expect(applyAuthoritativeGoals([{ goalId: "g", achieved: true, progress: 100, achievedAt: when }],
    [{ goalId: "g", achieved: true, progress: 100 }])[0].achievedAt).toBe(when);
});

test("termination labels distinguish goals, limit and manual end", () => {
  expect(practiceEndLabel("goals_achieved")).toContain("目标已达成");
  expect(practiceEndLabel("max_turns")).toContain("轮次上限");
  expect(practiceEndLabel("user_ended")).toContain("主动结束");
});
