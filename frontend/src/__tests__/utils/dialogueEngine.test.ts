import {
  shouldEndSession,
  getSessionEndReason,
  calculateCurrentTurns,
} from "../../utils/dialogueEngine";
import { dialogueConfig } from "../../config/dialogueConfig";
import type { Metrics, Goal, GoalStatus, Scenario } from "../../types/index";

describe("dialogueEngine", () => {
  // 测试用的基础数据
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
    it("计算正确的轮次数 - 偶数情况", () => {
      expect(calculateCurrentTurns(4)).toBe(2); // 4条消息 = 2轮
      expect(calculateCurrentTurns(6)).toBe(3); // 6条消息 = 3轮
    });

    it("计算正确的轮次数 - 奇数情况", () => {
      expect(calculateCurrentTurns(3)).toBe(2); // 3条消息 = 2轮（向上取整）
      expect(calculateCurrentTurns(5)).toBe(3); // 5条消息 = 3轮（向上取整）
    });
  });

  describe("shouldEndSession", () => {
    it("愤怒值达到最大值时返回 true", () => {
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

    it("所有目标都达成时返回 true", () => {
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

    it("消息数超过场景指定的最大轮次数时返回 true", () => {
      // 场景中指定 maxTurns: 5
      // 12条消息 = 6轮 > 5轮
      expect(
        shouldEndSession(
          baseMetrics,
          12,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(true);
      // 11条消息 = 6轮（向上取整） > 5轮
      expect(
        shouldEndSession(
          baseMetrics,
          11,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(true);
      // 10条消息 = 5轮 = 5轮
      expect(
        shouldEndSession(
          baseMetrics,
          10,
          baseGoalStatuses,
          baseGoals,
          baseScenario,
        ),
      ).toBe(false);
      // 9条消息 = 5轮（向上取整） = 5轮
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

    it("场景未指定 maxTurns 时使用默认值", () => {
      const scenarioWithoutMaxTurns = { ...baseScenario };
      delete scenarioWithoutMaxTurns.maxTurns;

      // 默认值为 dialogueConfig.MAX_MESSAGE_COUNT = 20
      // 42条消息 = 21轮 > 20轮
      expect(
        shouldEndSession(
          baseMetrics,
          42,
          baseGoalStatuses,
          baseGoals,
          scenarioWithoutMaxTurns,
        ),
      ).toBe(true);
      // 41条消息 = 21轮（向上取整） > 20轮
      expect(
        shouldEndSession(
          baseMetrics,
          41,
          baseGoalStatuses,
          baseGoals,
          scenarioWithoutMaxTurns,
        ),
      ).toBe(true);
      // 40条消息 = 20轮 = 20轮
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

    it("其他条件未满足时返回 false", () => {
      // 场景 maxTurns: 5，当前 3 轮（6条消息）
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
    it("愤怒值达到最大值时返回关于愤怒的消息", () => {
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
      expect(reason).toContain("不满");
    });

    it("所有目标达成时返回关于目标达成的消息", () => {
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
      expect(reason).toContain("已达成所有商谈目标");
    });

    it("消息数达到场景指定的最大轮次数时返回关于时间结束的消息", () => {
      // 10条消息 = 5轮
      const reason = getSessionEndReason(
        baseMetrics,
        10,
        baseGoalStatuses,
        baseGoals,
        baseScenario,
      );
      expect(reason).toContain("预定的商谈时间已结束");
    });

    it("场景未指定 maxTurns 时使用默认值", () => {
      const scenarioWithoutMaxTurns = { ...baseScenario };
      delete scenarioWithoutMaxTurns.maxTurns;

      // 默认值为 dialogueConfig.MAX_MESSAGE_COUNT = 20
      // 40条消息 = 20轮
      const reason = getSessionEndReason(
        baseMetrics,
        40,
        baseGoalStatuses,
        baseGoals,
        scenarioWithoutMaxTurns,
      );
      expect(reason).toContain("预定的商谈时间已结束");
    });

    it("其他条件未满足时返回一般消息", () => {
      // 其他条件未满足的情况（实际代码中可能不会到达这里）
      const reason = getSessionEndReason(
        baseMetrics,
        6,
        baseGoalStatuses,
        baseGoals,
        baseScenario,
      );
      expect(reason).toBe("商谈已结束。");
    });
  });
});
