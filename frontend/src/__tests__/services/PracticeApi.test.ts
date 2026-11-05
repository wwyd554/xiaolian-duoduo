import { ApiService } from "../../services/ApiService";
import type { NPC } from "../../types/index";

jest.mock("../../services/LocalAuth", () => ({
  LOCAL_BACKEND_URL: "http://localhost:8001",
  loadAuth: () => ({ token: "test-token", userId: "u" }),
}));

const npc: NPC = { name: "测试客户", role: "采购负责人", company: "测试公司", personality: [] };
const api = ApiService.getInstance();
const previousFetch = global.fetch;
afterEach(() => { global.fetch = previousFetch; jest.restoreAllMocks(); });

test("conversation preserves server completion and availability flags", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
    success: true, response: "已确认", sessionId: "s", messageId: "m", metrics: { trustLevel: 6 },
    sessionCompleted: true, terminationReason: "goals_achieved", evaluationStatus: "completed",
    scoringStatus: "completed", goalUpdates: [{ goalId: "g", achieved: false, reason: "撤销误判" }],
  }) });
  const result = await api.chatWithNPC("请确认", npc, [], "s", "m");
  expect(result).toMatchObject({ sessionCompleted: true, terminationReason: "goals_achieved", evaluationStatus: "completed" });
  const evaluation = await api.getRealtimeEvaluation("请确认", [], "s", [{ goalId: "g", achieved: true, progress: 100 }]);
  expect(evaluation.goalStatuses?.[0]).toMatchObject({ achieved: false, progress: 0 });
});

test("failed request throws instead of manufacturing a customer reply", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"));
  await expect(api.chatWithNPC("您好", npc, [], "s", "m")).rejects.toThrow("network unavailable");
});
