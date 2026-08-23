import React from "react";
import { render, screen } from "@testing-library/react";
import MessageAccordion from "../../components/referenceCheck/MessageAccordion";
import type { ReferenceCheckEvaluation } from "../../types/api";

// i18n 的 mock（返回默认值）
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, _defaultValue?: unknown, options?: unknown) => {
      const translations: { [key: string]: string } = {
        "referenceCheck.status.success": "适当",
        "referenceCheck.status.issue": "存在问题",
        "referenceCheck.status.notApplicable": "不适用",
        "referenceCheck.userMessage": "用户发言",
        "referenceCheck.relatedDocument": "相关文档",
        "referenceCheck.reviewComment": "审核意见",
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
 * MessageAccordion 组件的测试
 *
 * 验证根据 3 类评估（appropriate / not_applicable / issue）
 * 状态标签是否正确显示。
 */
describe("MessageAccordion", () => {
  const renderAccordion = (evaluation: ReferenceCheckEvaluation) =>
    render(
      <MessageAccordion
        message={{
          message: "测试消息",
          evaluation,
          relatedDocument: "测试资料",
          reviewComment: "测试意见",
        }}
        index={0}
      />,
    );

  test("appropriate 时显示「适当」标签", () => {
    renderAccordion("appropriate");
    expect(screen.getByText("适当")).toBeInTheDocument();
  });

  test("issue 时显示「存在问题」标签", () => {
    renderAccordion("issue");
    expect(screen.getByText("存在问题")).toBeInTheDocument();
  });

  test("not_applicable 时显示「不适用」标签", () => {
    renderAccordion("not_applicable");
    expect(screen.getByText("不适用")).toBeInTheDocument();
  });

  test("消息正文、相关文档、审核意见均显示", () => {
    renderAccordion("issue");
    expect(screen.getByText("测试消息")).toBeInTheDocument();
    expect(screen.getByText("测试资料")).toBeInTheDocument();
    expect(screen.getByText("测试意见")).toBeInTheDocument();
  });

  test("消息编号显示", () => {
    renderAccordion("appropriate");
    expect(
      screen.getByText((content) => content.startsWith("消息")),
    ).toBeInTheDocument();
  });
});
