import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResultPage from "../../pages/ResultPage";
import { ApiService } from "../../services/ApiService";

jest.mock("../../services/ApiService", () => ({ ApiService: { getInstance: jest.fn() } }));
jest.mock("react-i18next", () => { const t = (key: string) => key; return { useTranslation: () => ({ t }) }; });
jest.mock("chart.js", () => ({ Chart: { register: jest.fn() } }));
jest.mock("react-chartjs-2", () => ({ Line: () => null, Radar: () => null }));
jest.mock("../../components/referenceCheck/ReferenceCheck", () => () => null);
jest.mock("../../components/conversation/SlideZoomModal", () => () => null);
jest.mock("../../components/compliance/ComplianceViolationsList", () => () => null);
jest.mock("../../components/conversation/GoalResultsSection", () => () => null);

const api = { getSessionAnalysisStatus: jest.fn(), getSessionCompleteData: jest.fn(), getScenarioDetail: jest.fn() };
const skeleton = {
  success: true, sessionId: "session", sessionInfo: { sessionId: "session", scenarioId: "scenario", title: "历史练习", scenarioName: "冻结场景标题", status: "completed", createdAt: "2026-11-05T00:00:00Z" },
  messages: [], realtimeMetrics: [], complianceViolations: [], goalResults: { scenarioGoals: [], goalStatuses: [], goalScore: 0 },
};
const completed = {
  ...skeleton,
  messages: [{ messageId: "c1", sender: "npc", content: "换系统太麻烦了。", timestamp: "2026-11-05T00:00:00Z" }],
  businessReview: {
    rubricId: "sales-core", rubricVersion: "1.0.0", status: "incomplete", totalScore: null,
    criteria: [{ id: "S4", label: "理解并回应异议", weight: 20, status: "insufficient_evidence", score: null,
      reason: "缺少销售回应", evidence: [{ messageId: "c1", speaker: "npc", quote: "换系统太麻烦了。" }], checkedMessageIds: ["c1"], missingBehavior: "", nextPractice: "" }],
    coaching: { keep: "", fix: "", nextPractice: "", focusCriterionId: null },
    riskChecks: { status: "not_checked", limitations: "未完成事实核对", findings: [] }, coverage: { assessed: 0, applicable: 1 },
  },
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(ApiService.getInstance).mockReturnValue(api as unknown as ApiService);
  api.getScenarioDetail.mockResolvedValue({ scenarioId: "scenario", title: "题库已经改名", goals: [] });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const mount = () => render(<MemoryRouter initialEntries={["/result/session"]}><Routes><Route path="/result/:sessionId" element={<ResultPage />} /></Routes></MemoryRouter>);

test("a rubric report loads without any legacy feedback/sub-scores and keeps the historical scenario title", async () => {
  api.getSessionAnalysisStatus.mockResolvedValue({ status: "completed" });
  api.getSessionCompleteData.mockResolvedValue(completed);
  mount();
  expect(await screen.findByText("待补全")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("冻结场景标题");
  expect(screen.getByText("原始对话 · 1 条")).toBeInTheDocument();
  expect(screen.queryByText("results.performanceLevels.excellent")).not.toBeInTheDocument();
});

test("poll completion replaces the processing skeleton messages so evidence can locate the actual transcript", async () => {
  api.getSessionAnalysisStatus.mockResolvedValueOnce({ status: "processing" }).mockResolvedValue({ status: "completed" });
  api.getSessionCompleteData.mockResolvedValueOnce(skeleton).mockResolvedValue(completed);
  mount();
  expect(await screen.findByText("results.analysisInProgressTitle")).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(await screen.findByText("原始对话 · 1 条")).toBeInTheDocument();
  const original = document.getElementById("review-message-c1") as HTMLElement;
  original.scrollIntoView = jest.fn();
  fireEvent.click(screen.getByRole("button", { name: /理解并回应异议/ }));
  fireEvent.click(screen.getByRole("button", { name: "定位这句原话" }));
  expect(original.scrollIntoView).toHaveBeenCalled();
});

test("failure fetching a completed report displays an explicit error instead of stopping silently", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  api.getSessionAnalysisStatus.mockResolvedValueOnce({ status: "processing" }).mockResolvedValue({ status: "completed" });
  api.getSessionCompleteData.mockResolvedValueOnce(skeleton).mockRejectedValue(new Error("network"));
  mount();
  expect(await screen.findByText("results.analysisInProgressTitle")).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(await screen.findByRole("alert")).toHaveTextContent("复盘结果暂时加载失败");
  expect(screen.getByRole("button", { name: "results.reloadPage" })).toBeInTheDocument();
});
