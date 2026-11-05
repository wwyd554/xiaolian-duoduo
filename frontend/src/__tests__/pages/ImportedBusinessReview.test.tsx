import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ImportedReviewPage from "../../pages/history/ImportedReviewPage";
import { ApiService } from "../../services/ApiService";
import type { ImportedReviewDetail } from "../../types/reviews";

jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn() } }));
const load = jest.fn();
beforeEach(() => { jest.mocked(ApiService.getInstance).mockReturnValue({ getImportedReview: load } as unknown as ApiService); });

const base: ImportedReviewDetail = {
  title: "一次微信沟通", context: "了解迁移顾虑", source: "chat", status: "completed",
  messages: [{ messageId: "c1", role: "npc", content: "换系统太麻烦了。" }],
  report: { summary: "旧版总结", stage: "需求确认", limitations: "只有部分对话", findings: [], replies: [] },
};
const mount = () => render(<MemoryRouter initialEntries={["/reviews/test"]}><Routes><Route path="/reviews/:sessionId" element={<ImportedReviewPage />} /></Routes></MemoryRouter>);

test("new imported reviews render rubric evidence and keep the original message available without a broken practice button", async () => {
  load.mockResolvedValue({ ...base, report: { ...base.report, businessReview: {
    rubricId: "sales-core", rubricVersion: "1.0.0", status: "incomplete", totalScore: null,
    criteria: [{ id: "S4", label: "理解并回应异议", weight: 20, status: "insufficient_evidence", score: null,
      reason: "缺少销售回应", evidence: [{ messageId: "c1", speaker: "npc", quote: "换系统太麻烦了。" }], checkedMessageIds: ["c1"], missingBehavior: "", nextPractice: "" }],
    coaching: { keep: "", fix: "", nextPractice: "", focusCriterionId: null },
    riskChecks: { status: "not_checked", limitations: "未完成事实核对", findings: [] }, coverage: { assessed: 0, applicable: 1 },
  } } });
  const { container } = mount();
  expect(await screen.findByText("待补全")).toBeInTheDocument();
  expect(screen.queryByText("旧版总结")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /专项再练/ })).not.toBeInTheDocument();
  const original = container.querySelector("#import-message-c1") as HTMLElement;
  expect(original).toHaveTextContent("换系统太麻烦了。");
  original.scrollIntoView = jest.fn();
  fireEvent.click(screen.getByRole("button", { name: /理解并回应异议/ }));
  fireEvent.click(screen.getByRole("button", { name: "定位这句原话" }));
  expect(original.scrollIntoView).toHaveBeenCalled();
});

test("historical imports without a rubric still show the existing report", async () => {
  load.mockResolvedValue(base);
  mount();
  expect(await screen.findByText("旧版总结")).toBeInTheDocument();
  expect(screen.getByText("只有部分对话")).toBeInTheDocument();
  expect(screen.queryByText("本次能力表现")).not.toBeInTheDocument();
});
