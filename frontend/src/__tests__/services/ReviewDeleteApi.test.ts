import { ApiService } from "../../services/ApiService";

jest.mock("../../services/LocalAuth", () => ({ LOCAL_BACKEND_URL: "http://localhost:8001", loadAuth: () => ({ token: "test-token", userId: "u" }) }));
const api = ApiService.getInstance();
const oldFetch = global.fetch;
afterEach(() => { global.fetch = oldFetch; jest.restoreAllMocks(); });

test("deleting a review sends an authenticated DELETE request for the selected identifier", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, sessionId: "record/1" }) });
  expect(await api.deleteReview("record/1")).toEqual({ success: true, sessionId: "record/1" });
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:8001/reviews/record%2F1", expect.objectContaining({ method: "DELETE", headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }));
});

test("a rejected deletion surfaces the backend error instead of reporting success", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, text: async () => JSON.stringify({ detail: "复盘记录不存在或已删除" }) });
  await expect(api.deleteReview("missing")).rejects.toThrow("复盘记录不存在或已删除");
});
