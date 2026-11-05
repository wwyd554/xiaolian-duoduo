import { ApiService } from "../../services/ApiService";

jest.mock("../../services/LocalAuth", () => ({
  LOCAL_BACKEND_URL: "http://localhost:8001",
  loadAuth: () => ({ token: "test-token", userId: "u" }),
}));

const api = ApiService.getInstance();
const oldFetch = global.fetch;
afterEach(() => { global.fetch = oldFetch; jest.restoreAllMocks(); });

test("practice plan requests the selected criterion from the owned source session", async () => {
  const plan = { scenarioId: "renewal", sourceSessionId: "source", criterionId: "S4", previousScore: 0 };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => plan });
  expect(await api.getPracticePlan("source", "S4")).toEqual(plan);
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/sessions/source/practice-plan"), expect.objectContaining({ method: "POST", body: JSON.stringify({ criterionId: "S4" }) }));
});

test("session creation carries the source and selected criterion to the backend", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, sessionId: "new", isNew: true }) });
  await api.createOrUpdateSession("new", "renewal", "专项练习", undefined, { practiceSourceSessionId: "source", practiceCriterionId: "S4" });
  const request = (global.fetch as jest.Mock).mock.calls[0][1];
  expect(JSON.parse(request.body)).toEqual({ sessionId: "new", scenarioId: "renewal", title: "专项练习", practiceSourceSessionId: "source", practiceCriterionId: "S4" });
});

test("failed creation throws so a focused session cannot continue as an ordinary unsaved session", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn().mockRejectedValue(new Error("unavailable"));
  await expect(api.createOrUpdateSession("new", "renewal", undefined, undefined, { practiceSourceSessionId: "source", practiceCriterionId: "S4" })).rejects.toThrow("unavailable");
});
