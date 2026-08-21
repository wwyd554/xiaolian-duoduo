import {
  shouldEndSession,
  getSessionEndReason,
  calculateCurrentTurns,
} from "../../utils/dialogueEngine";
import { dialogueConfig } from "../../config/dialogueConfig";
import type { Metrics, Goal, GoalStatus, Scenario } from "../../types/index";

describe("dialogueEngine", () => {
  // テスト用の基本データ
  const baseMetrics: Metrics = {
    angerLevel: 3,
    trustLevel: 5,
    progressLevel: 4,
  };

  const baseGoals: Goal[] = [
    {
      id: "goal1",
      description: "Goal 1",
      priority: 1,
      criteria: [],
      isRequired: true,
    },
    {
      id: "goal2",
      description: "Goal 2",
      priority: 2,
      criteria: [],
      isRequired: false,
    },
  ];

  const baseGoalStatuses: GoalStatus[] = [
    { goalId: "goal1", achieved: false, progress: 0 },
    { goalId: "goal2", achieved: false, progress: 0 },
  ];

  const baseScenario: Scenario = {
    id: "test-scenario",
    title: "Test Scenario",
    description: "Test description",
    npc: {
      id: "test-npc",
      name: "Test NPC",
      role: "Tester",
      company: "Test Company",
      personality: ["Test"],
      avatar: "😀",
      description: "Test description",
    },
    objectives: ["Test objective"],
    industry: "Test",
    difficulty: "easy",
    initialMetrics: baseMetrics,
    goals: baseGoals,
    maxTurns: 5,
  };

  describe("calculateCurrentTurns", () => {
    it("正しいターン数を計算する - 偶数の場合", () => {
      expect(calculateCurrentTurns(4)).toBe(2); // 4メッセージ = 2ターン
      expect(calculateCurrentTurns(6)).toBe(3); // 6メッセージ = 3ターン
    });

    it("正しいターン数を計算する - 奇数の場合", () => {
      expect(calculateCurrentTurns(3)).toBe(2); // 3メッセージ = 2ターン（切り上げ）
      expect(calculateCurrentTurns(5)).toBe(3); // 5メッセージ = 3ターン（切り上げ）
    });
  });

  describe("shouldEndSession", () => {
    it("怒りが最大値に達した場合はtrueを返す", () => {
      const angryMetrics = {
        ...baseMetrics,
        angerLevel: dialogueConfig.METRICS_MAX,
      };
      expect(
        shouldEndSession(
          angryMetrics,
          5,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(true);
    });

    it("すべてのゴールが達成された場合はtrueを返す", () => {
      const allGoalsAchieved = [
        { goalId: "goal1", achieved: true, progress: 100 },
        { goalId: "goal2", achieved: true, progress: 100 },
      ];
      expect(
        shouldEndSession(
          baseMetrics,
          5,
          allGoalsAchieved,
          baseGoals,
          baseScenario,
        ),
      ).toBe(true);
    });

    it("メッセージ数がシナリオで指定された最大ターン数を超えた場合はtrueを返す", () => {
      // シナリオでmaxTurns: 5を指定
      // 12メッセージ = 6ターン > 5ターン
      expect(
        shouldEndSession(
          baseMetrics,
          12,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(true);
      // 11メッセージ = 6ターン（切り上げ） > 5ターン
      expect(
        shouldEndSession(
          baseMetrics,
          11,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(true);
      // 10メッセージ = 5ターン = 5ターン
      expect(
        shouldEndSession(
          baseMetrics,
          10,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(false);
      // 9メッセージ = 5ターン（切り上げ） = 5ターン
      expect(
        shouldEndSession(
          baseMetrics,
          9,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(false);
    });

    it("シナリオにmaxTurnsが指定されていない場合はデフォルト値を使用する", () => {
      const scenarioWithoutMaxTurns = { ...baseScenario };
      delete scenarioWithoutMaxTurns.maxTurns;

      // デフォルト値は dialogueConfig.MAX_MESSAGE_COUNT = 20
      // 42メッセージ = 21ターン > 20ターン
      expect(
        shouldEndSession(
          baseMetrics,
          42,
          baseGoalStatuses,
          baseGoals,
          scenarioWithoutMaxTurns,
        ),
      ).toBe(true);
      // 41メッセージ = 21ターン（切り上げ） > 20ターン
      expect(
        shouldEndSession(
          baseMetrics,
          41,
          baseGoalStatuses,
          baseGoals,
          scenarioWithoutMaxTurns,
        ),
      ).toBe(true);
      // 40メッセージ = 20ターン = 20ターン
      expect(
        shouldEndSession(
          baseMetrics,
          40,
          baseGoalStatuses,
          baseGoals,
          scenarioWithoutMaxTurns,
        ),
      ).toBe(false);
    });

    it("他の条件が満たされていない場合はfalseを返す", () => {
      // シナリオmaxTurns: 5、現在3ターン（6メッセージ）
      expect(
        shouldEndSession(
          baseMetrics,
          6,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(false);
    });
  });

  describe("getSessionEndReason", () => {
    it("怒りが最大値に達した場合は怒りに関するメッセージを返す", () => {
      const angryMetrics = {
        ...baseMetrics,
        angerLevel: dialogueConfig.METRICS_MAX,
      };
      const reason = getSessionEndReason(
        angryMetrics,
        5,
        baseGoalStatuses,
        baseGoals,
        baseScenario,
      );
      expect(reason).toContain("不快");
    });

    it("すべてのゴールが達成された場合はゴール達成に関するメッセージを返す", () => {
      const allGoalsAchieved = [
        { goalId: "goal1", achieved: true, progress: 100 },
        { goalId: "goal2", achieved: true, progress: 100 },
      ];
      const reason = getSessionEndReason(
        baseMetrics,
        5,
        allGoalsAchieved,
        baseGoals,
        baseScenario,
      );
      expect(reason).toContain("すべての商談目標を達成");
    });

    it("メッセージ数がシナリオで指定された最大ターン数に達した場合は時間終了に関するメッセージを返す", () => {
      // 10メッセージ = 5ターン
      const reason = getSessionEndReason(
        baseMetrics,
        10,
        baseGoalStatuses,
        baseGoals,
        baseScenario,
      );
      expect(reason).toContain("予定していた商談時間が終了");
    });

    it("シナリオにmaxTurnsが指定されていない場合はデフォルト値を使用する", () => {
      const scenarioWithoutMaxTurns = { ...baseScenario };
      delete scenarioWithoutMaxTurns.maxTurns;

      // デフォルト値は dialogueConfig.MAX_MESSAGE_COUNT = 20
      // 40メッセージ = 20ターン
      const reason = getSessionEndReason(
        baseMetrics,
        40,
        baseGoalStatuses,
        baseGoals,
        scenarioWithoutMaxTurns,
      );
      expect(reason).toContain("予定していた商談時間が終了");
    });

    it("他の条件が満たされていない場合は一般的なメッセージを返す", () => {
      // 他の条件が満たされていない場合（実際のコードではここには到達しないかも）
      const reason = getSessionEndReason(
        baseMetrics,
        6,
        baseGoalStatuses,
        baseGoals,
        baseScenario,
      );
      expect(reason).toBe("商談が終了しました。");
    });
  });
});
