/**
 * GoalResultsSection 组件的测试
 *
 * 缺陷复现: 虽然 goalStatuses 中存在 achieved: true 的数据，
 * 但结果页面仍显示为 0/1（未达成）问题的回归测试
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import GoalResultsSection from "../components/conversation/GoalResultsSection";
import type { Goal, GoalStatus } from "../types/index";

// i18next mock
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

describe("GoalResultsSection", () => {
  const baseGoal: Goal = {
    id: "goal-1770703368830",
    description: "进行问候",
    isRequired: true,
    priority: 3,
    criteria: ["进行问候"],
  };

  describe("目标达成状态的正确显示", () => {
    test("存在 achieved: true 的 goalStatus 时，达成目标数正确显示", () => {
      const goals: Goal[] = [baseGoal];
      const goalStatuses: GoalStatus[] = [
        {
          goalId: "goal-1770703368830",
          achieved: true,
          progress: 100,
          achievedAt: new Date(1770706147346),
        },
      ];

      render(<GoalResultsSection goals={goals} goalStatuses={goalStatuses} />);

      // 达成目标数和必达目标达成均为 1/1 显示
      const counts = screen.getAllByText("1 / 1");
      expect(counts).toHaveLength(2); // 达成目标数 + 必达目标达成
      // 进度显示为 100%
      expect(screen.getByText("100%")).toBeTruthy();
      // 勾选图标显示
      expect(screen.getByTestId("CheckCircleIcon")).toBeTruthy();
    });

    test("存在 achieved: false 的 goalStatus 时，显示为未达成", () => {
      const goals: Goal[] = [baseGoal];
      const goalStatuses: GoalStatus[] = [
        {
          goalId: "goal-1770703368830",
          achieved: false,
          progress: 0,
        },
      ];

      render(<GoalResultsSection goals={goals} goalStatuses={goalStatuses} />);

      // 达成目标数和必达目标达成均为 0/1 显示
      const counts = screen.getAllByText("0 / 1");
      expect(counts).toHaveLength(2);
      // 取消图标显示
      expect(screen.getByTestId("CancelIcon")).toBeTruthy();
    });

    test("goalStatuses 为空数组时，全部显示为未达成（缺陷复现场景）", () => {
      // 本测试用例即本次缺陷的复现
      // 当后端返回的 goalResults 为 null 时，
      // 前端 goalStatuses 变为空数组，全部显示为未达成
      const goals: Goal[] = [baseGoal];
      const goalStatuses: GoalStatus[] = [];

      render(<GoalResultsSection goals={goals} goalStatuses={goalStatuses} />);

      // 达成目标数显示为 0/1
      const counts = screen.getAllByText("0 / 1");
      expect(counts).toHaveLength(2);
      // 进度显示为 0%
      expect(screen.getByText("0%")).toBeTruthy();
    });

    test("goalId 不匹配时使用默认值（未达成）", () => {
      const goals: Goal[] = [baseGoal];
      const goalStatuses: GoalStatus[] = [
        {
          goalId: "goal-different-id",
          achieved: true,
          progress: 100,
        },
      ];

      render(<GoalResultsSection goals={goals} goalStatuses={goalStatuses} />);

      // goalId 不匹配，因此必达目标达成显示 0/1
      // 但 goalStatuses.filter(s => s.achieved) 为 1，因此达成目标数显示 1/1
      expect(screen.getByText("0 / 1")).toBeTruthy(); // 必达目标达成
    });
  });

  describe("多目标的达成状态", () => {
    test("多目标部分达成时，正确计数显示", () => {
      const goals: Goal[] = [
        baseGoal,
        {
          id: "goal-2",
          description: "进行自我介绍",
          isRequired: false,
          priority: 2,
          criteria: ["进行自我介绍"],
        },
      ];
      const goalStatuses: GoalStatus[] = [
        {
          goalId: "goal-1770703368830",
          achieved: true,
          progress: 100,
        },
        {
          goalId: "goal-2",
          achieved: false,
          progress: 30,
        },
      ];

      render(<GoalResultsSection goals={goals} goalStatuses={goalStatuses} />);

      // 达成目标数显示为 1/2
      expect(screen.getByText("1 / 2")).toBeTruthy();
      // 进度条的值显示
      expect(screen.getByText("100%")).toBeTruthy();
      expect(screen.getByText("30%")).toBeTruthy();
    });
  });

  describe("必达目标的达成状态", () => {
    test("必达目标达成时，必达目标达成数正确显示", () => {
      const goals: Goal[] = [
        { ...baseGoal, isRequired: true },
        {
          id: "goal-2",
          description: "进行自我介绍",
          isRequired: false,
          priority: 2,
          criteria: [],
        },
      ];
      const goalStatuses: GoalStatus[] = [
        {
          goalId: "goal-1770703368830",
          achieved: true,
          progress: 100,
        },
        {
          goalId: "goal-2",
          achieved: true,
          progress: 100,
        },
      ];

      render(<GoalResultsSection goals={goals} goalStatuses={goalStatuses} />);

      // 达成目标数 2/2
      expect(screen.getByText("2 / 2")).toBeTruthy();
      // 必达目标达成 1/1
      expect(screen.getByText("1 / 1")).toBeTruthy();
    });
  });

  describe("goals 为空时", () => {
    test("goals 为空数组时，不显示任何内容", () => {
      const { container } = render(
        <GoalResultsSection goals={[]} goalStatuses={[]} />,
      );
      expect(container.innerHTML).toBe("");
    });
  });
});
