import { fireEvent, render, screen } from "@testing-library/react";
import BusinessReviewPanel from "../../components/review/BusinessReviewPanel";
import type { BusinessReview } from "../../types/businessReview";

function review(): BusinessReview {
  return {
    rubricId: "sales-core", rubricVersion: "1.0.0", status: "completed", totalScore: 0,
    criteria: [{ id: "S4", label: "理解并回应异议", weight: 20, status: "assessed", score: 0,
      reason: "销售没有回应客户的迁移顾虑。", evidence: [{ messageId: "customer-1", speaker: "npc", quote: "换系统太麻烦了。" }],
      checkedMessageIds: ["customer-1", "sales-1"], missingBehavior: "澄清顾虑", nextPractice: "先询问最担心哪项成本。" }],
    coaching: { keep: "表达简短。", fix: "先澄清顾虑。", nextPractice: "从客户提出变更成本开始练。", focusCriterionId: "S4" },
    riskChecks: { status: "not_checked", limitations: "没有产品资料，本次未完成产品事实核对。", findings: [] },
    coverage: { assessed: 1, applicable: 1 },
  };
}

test("a real zero score remains visible and does not become an unavailable score or certification", () => {
  render(<BusinessReviewPanel review={review()} />);
  expect(screen.getByRole("heading", { level: 3, name: "0 / 100" })).toHaveTextContent("0/ 100");
  expect(screen.queryByText("待补全")).not.toBeInTheDocument();
  expect(screen.getByText(/不代表上岗认证/)).toBeInTheDocument();
  expect(screen.getByText(/本次未完成产品事实核对/)).toBeInTheDocument();
  expect(screen.queryByText("无违规")).not.toBeInTheDocument();
});

test("missing evidence preserves null total and cannot generate a focused practice from an unassessed item", () => {
  const value = review();
  value.totalScore = null;
  value.status = "incomplete";
  value.criteria[0].status = "insufficient_evidence";
  value.criteria[0].score = null;
  value.coverage.assessed = 0;
  render(<BusinessReviewPanel review={value} onPractice={jest.fn()} />);
  expect(screen.getByRole("heading", { level: 3, name: "待补全" })).toHaveTextContent("待补全");
  expect(screen.getByText("证据不足")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /专项再练/ })).not.toBeInTheDocument();
});

test("evidence is inspectable and sends the actual message id to the transcript locator", () => {
  const locate = jest.fn();
  render(<BusinessReviewPanel review={review()} onEvidence={locate} />);
  fireEvent.click(screen.getByRole("button", { name: /理解并回应异议/ }));
  expect(screen.getByText("换系统太麻烦了。")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "定位这句原话" }));
  expect(locate).toHaveBeenCalledWith("customer-1");
});

test("focused retry uses a criterion id and disables duplicate submissions", () => {
  const practice = jest.fn();
  const { rerender } = render(<BusinessReviewPanel review={review()} onPractice={practice} />);
  fireEvent.click(screen.getByRole("button", { name: /专项再练/ }));
  expect(practice).toHaveBeenCalledWith("S4");
  rerender(<BusinessReviewPanel review={review()} onPractice={practice} practicing />);
  expect(screen.getByRole("button", { name: /专项再练/ })).toBeDisabled();
});

test("comparisons show zero-valued scores correctly and explain incompatible assessments", () => {
  const comparison = { sourceSessionId: "old", criterionId: "S4" as const, previousScore: 0, currentScore: 1, delta: 1, comparable: true, reason: "" };
  const { rerender } = render(<BusinessReviewPanel review={review()} comparison={comparison} />);
  expect(screen.getByText(/本次专项 1\/2，上次 0\/2，变化 \+1/)).toBeInTheDocument();
  rerender(<BusinessReviewPanel review={review()} comparison={{ ...comparison, comparable: false, reason: "规则版本不同，不能直接比较。" }} />);
  expect(screen.getByText("规则版本不同，不能直接比较。")).toBeInTheDocument();
});
