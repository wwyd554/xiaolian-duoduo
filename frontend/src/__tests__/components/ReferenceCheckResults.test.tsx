import React from "react";
import { render, screen } from "@testing-library/react";
import ReferenceCheckResults from "../../components/referenceCheck/ReferenceCheckResults";
import type { ReferenceCheckResult } from "../../types/api";

// i18n 的 mock（返回默认值）
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, _defaultValue?: unknown, options?: unknown) => {
      const translations: { [key: string]: string } = {
        "referenceCheck.noIssuesTitle": "没有问题",
        "referenceCheck.noIssues": "未发现一致性问题。",
        "referenceCheck.issuesFoundTitle": "发现问题",
        "referenceCheck.issuesFoundDescription": "发现有问题。",
        "referenceCheck.problemMessages": "存在问题的消息",
        "referenceCheck.allMessages": "全部消息详情",
        "referenceCheck.status.success": "适当",
        "referenceCheck.status.issue": "存在问题",
        "referenceCheck.status.notApplicable": "不适用",
        "referenceCheck.userMessage": "用户发言",
        "referenceCheck.relatedDocument": "相关文档",
        "referenceCheck.reviewComment": "审核意见",
        "referenceCheck.explanationTitle": "关于资料检查",
        "referenceCheck.explanation1": "说明1",
        "referenceCheck.explanation2": "说明2",
      };
      if (key === "referenceCheck.messageNumber") {
        const opts = options as { number: number } | undefined;
        return `消息 ${opts?.number ?? ""}`;
      }
      return translations[key] || key;
    },
  }),
}));

/**
 * ReferenceCheckResults 组件的测试
 *
 * 验证根据 issuesCount 的显示分支，以及问题列表中仅提取「issue」。
 */
describe("ReferenceCheckResults", () => {
  const createData = (
    evaluations: ReferenceCheckResult["messages"][number]["evaluation"][],
  ): ReferenceCheckResult => ({
    messages: evaluations.map((evaluation, index) => ({
      message: `发言${index + 1}`,
      relatedDocument: "",
      reviewComment: "",
      evaluation,
    })),
    summary: {
      totalMessages: evaluations.length,
      checkedMessages: evaluations.length,
    },
  });

  test("issuesCount 为 0 时显示「没有问题」", () => {
    const data = createData(["appropriate", "not_applicable"]);
    render(<ReferenceCheckResults data={data} issuesCount={0} />);

    expect(screen.getByText("没有问题")).toBeInTheDocument();
    expect(screen.queryByText("发现问题")).not.toBeInTheDocument();
  });

  test("仅不适用对象的会话显示「没有问题」", () => {
    // 仅问候和一般推进等无需资料参考的发言场景
    const data = createData(["not_applicable", "not_applicable"]);
    render(<ReferenceCheckResults data={data} issuesCount={0} />);

    expect(screen.getByText("没有问题")).toBeInTheDocument();
  });

  test("issuesCount 大于等于 1 时显示「发现问题」", () => {
    const data = createData(["issue", "appropriate"]);
    render(<ReferenceCheckResults data={data} issuesCount={1} />);

    // AlertTitle 内为数量显示被拆分为多个节点，因此用部分匹配确认
    expect(
      screen.getByText((content) => content.includes("发现问题")),
    ).toBeInTheDocument();
    expect(screen.queryByText("没有问题")).not.toBeInTheDocument();
  });

  test("存在问题的消息部分仅提取 issue", () => {
    const data = createData(["issue", "appropriate", "not_applicable"]);
    render(<ReferenceCheckResults data={data} issuesCount={1} />);

    // 「存在问题的消息」标题显示
    expect(screen.getByText("存在问题的消息")).toBeInTheDocument();

    // 问题部分 + 全部消息详情中显示「存在问题」标签
    // issue 为 1 条，因此问题部分 1 处、全部消息 1 处 = 2 处
    expect(screen.getAllByText("存在问题").length).toBe(2);
  });

  test("全部消息详情部分显示全部数量", () => {
    const data = createData(["issue", "appropriate", "not_applicable"]);
    render(<ReferenceCheckResults data={data} issuesCount={1} />);

    // 全部消息详情部分存在（数量显示被拆分，因此用部分匹配）
    expect(
      screen.getByText((content) => content.includes("全部消息详情")),
    ).toBeInTheDocument();
    // 不适用标签在全部消息详情中显示
    expect(screen.getByText("不适用")).toBeInTheDocument();
  });
});
