import { ApiService } from "../../services/ApiService";
import { loadAuth } from "../../services/LocalAuth";

jest.mock("../../services/LocalAuth", () => ({
  LOCAL_BACKEND_URL: "http://localhost:8001",
  loadAuth: jest.fn(),
}));

const api = ApiService.getInstance();
const previousFetch = global.fetch;
const result = {
  text: "你好",
  segments: [{ start: 0, end: 1, text: "你好" }],
  durationSeconds: 1,
  language: "zh",
};

beforeEach(() => {
  jest.clearAllMocks();
  (loadAuth as jest.Mock).mockReturnValue({ token: "test-token", userId: "u" });
});
afterEach(() => {
  global.fetch = previousFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("recording upload sends authenticated multipart data to the local API without a JSON Content-Type", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => result });
  const file = new File(["audio"], "sales.m4a", { type: "audio/mp4" });
  await expect(api.transcribeRecording(file)).resolves.toEqual(result);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
    string,
    RequestInit,
  ];
  expect(url).toBe("http://localhost:8001/reviews/transcribe");
  expect(init.method).toBe("POST");
  expect(new Headers(init.headers).get("Authorization")).toBe(
    "Bearer test-token",
  );
  expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  expect(init.body).toBeInstanceOf(FormData);
  expect((init.body as FormData).get("file")).toBe(file);
  expect((init.body as FormData).get("language")).toBe("zh");
});

test("server validation errors are shown instead of returning a fabricated transcript", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 422,
    json: async () => ({ detail: "录音时长不能超过 15 分钟" }),
  });
  await expect(
    api.transcribeRecording(new File(["audio"], "long.wav")),
  ).rejects.toThrow("录音时长不能超过 15 分钟");
});

test("caller cancellation reaches fetch and keeps cancellation distinct from connection errors", async () => {
  global.fetch = jest.fn().mockImplementation(
    (_url, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  const caller = new AbortController();
  const pending = api.transcribeRecording(
    new File(["audio"], "sales.wav"),
    caller.signal,
  );
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await Promise.resolve();
  caller.abort();
  await rejected;
  const requestSignal = (global.fetch as jest.Mock).mock.calls[0][1]
    .signal as AbortSignal;
  expect(requestSignal.aborted).toBe(true);
});

test("a stalled local transcription is aborted after the bounded waiting period", async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation(
    (_url, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  const pending = api.transcribeRecording(new File(["audio"], "sales.wav"));
  const rejected = expect(pending).rejects.toThrow("本次转写等待超时");
  await Promise.resolve();
  await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
});

test("without authentication no recording is sent", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  (loadAuth as jest.Mock).mockReturnValue(null);
  global.fetch = jest.fn();
  await expect(
    api.transcribeRecording(new File(["audio"], "sales.wav")),
  ).rejects.toThrow("用户未登录");
  expect(global.fetch).not.toHaveBeenCalled();
});
