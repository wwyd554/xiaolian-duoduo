import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ProductDemoPage from "../../pages/ProductDemoPage";
import { ApiService } from "../../services/ApiService";
import type { ProductDemo } from "../../types/productDemo";
import type { BusinessReview } from "../../types/businessReview";

jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn(() => { throw new Error("A static demo must not call the live API"); }) } }));
const review = (score: 0 | 1): BusinessReview => ({
  rubricId: "sales-core", rubricVersion: "1.0.0", status: "completed", totalScore: score * 50,
  criteria: [{ id: "S4", label: "回应顾虑", weight: 20, status: "assessed", score, reason: "依据这段原话评估", evidence: [{ messageId: "c1", speaker: "npc", quote: "表格够用了。" }], checkedMessageIds: ["c1", "u1"], missingBehavior: "先确认顾虑", nextPractice: "先问清顾虑，再介绍功能" }],
  coaching: { keep: "对话保持礼貌", fix: "先确认顾虑", nextPractice: "下一轮先问清使用难点", focusCriterionId: "S4" },
  riskChecks: { status: "not_checked", limitations: "未完成事实核对", findings: [] }, coverage: { assessed: 1, applicable: 1 },
});
const demo: ProductDemo = {
  scenarioId: "demo-store-value-v1", scenarioTitle: "咖啡店会员工具", product: { name: "示例会员工具", label: "模拟产品", facts: ["支持会员记录"] }, customer: { name: "陈老板", role: "店主", company: "小陈咖啡", context: "使用表格管理会员" }, goal: "理解使用顾虑", generatedAt: "2026-11-05T00:00:00Z", provenance: { kind: "synthetic-model-evaluated", notice: "两段模拟对话，预先生成的示例报告。" },
  examples: [
    { id: "before", label: "常见说法", description: "直接介绍功能", messages: [{ id: "c1", role: "npc", content: "表格够用了。" }, { id: "u1", role: "user", content: "我们的功能很丰富。" }], review: review(0) },
    { id: "after", label: "调整后示范", description: "先确认顾虑再回应", messages: [{ id: "c1", role: "npc", content: "表格够用了。" }, { id: "u1", role: "user", content: "您更担心录入麻烦，还是员工不会用？" }], review: review(1) },
  ],
};
const Destination = () => { const location = useLocation(); return <div data-testid="destination">{location.pathname}{location.search}</div>; };
const mount = (path = "/demo") => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/demo" element={<ProductDemoPage demo={demo} />} /><Route path="/conversation/:id" element={<Destination />} /><Route path="/" element={<div>首页</div>} /></Routes></MemoryRouter>);
beforeEach(() => jest.clearAllMocks());

test("steps are freely selectable and sample practice starts independently without a static session ID", () => {
  mount();
  expect(screen.getByText("模拟案例 · 示例报告")).toBeInTheDocument();
  expect(screen.getByText("预写模拟对话 · AI 生成示例复盘")).toBeVisible();
  expect(screen.getByRole("button", { name: /示例说明/ })).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button", { name: /示例说明/ }));
  expect(screen.getByRole("button", { name: /示例说明/ })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("两段模拟对话，预先生成的示例报告。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "3. 带着目标再练" }));
  expect(screen.getByText("先问清顾虑，再介绍功能")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "现在试一轮" }));
  expect(screen.getByTestId("destination")).toHaveTextContent(/^\/conversation\/demo-store-value-v1$/);
  expect(ApiService.getInstance).not.toHaveBeenCalled();
});

test("the review deep link switches between two simulated examples and preserves zero scores", () => {
  mount("/demo?step=review");
  expect(screen.getByText("我们的功能很丰富。")).toBeInTheDocument();
  expect(screen.getByText(/不代表真实用户的成长数据/)).toBeInTheDocument();
  expect(screen.getByText("0/2 · 常见说法")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "调整后示范" }));
  expect(screen.getByText("您更担心录入麻烦，还是员工不会用？")).toBeInTheDocument();
  expect(screen.queryByText("我们的功能很丰富。")).not.toBeInTheDocument();
  expect(screen.getByText("1/2 · 调整后示范")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /专项再练/ })).not.toBeInTheDocument();
  expect(ApiService.getInstance).not.toHaveBeenCalled();
});

test("rubric evidence scrolls to the selected sample's original message", () => {
  mount("/demo?step=review&example=after");
  const original = document.getElementById("demo-message-after-c1")!;
  original.scrollIntoView = jest.fn();
  fireEvent.click(screen.getByRole("button", { name: "定位这句原话" }));
  expect(original.scrollIntoView).toHaveBeenCalled();
  expect(within(original).getByText("表格够用了。")).toBeInTheDocument();
});
