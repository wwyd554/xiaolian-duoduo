import {
  loadVideoRecordingEnabled,
  saveVideoRecordingEnabled,
  DEFAULT_VIDEO_RECORDING_ENABLED,
} from "../videoRecordingSettings";

describe("videoRecordingSettings", () => {
  // 在每次测试前重置 localStorage 和 console.warn 的 mock
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  describe("loadVideoRecordingEnabled", () => {
    test("未设置时返回默认值（当前默认关闭录制）", () => {
      expect(loadVideoRecordingEnabled()).toBe(DEFAULT_VIDEO_RECORDING_ENABLED);
      expect(loadVideoRecordingEnabled()).toBe(false);
    });

    test('保存了"true"时返回 true', () => {
      localStorage.setItem("videoRecordingEnabled", "true");
      expect(loadVideoRecordingEnabled()).toBe(true);
    });

    test('保存了"false"时返回 false', () => {
      localStorage.setItem("videoRecordingEnabled", "false");
      expect(loadVideoRecordingEnabled()).toBe(false);
    });

    test("非法值按 false 处理（即非 true）", () => {
      localStorage.setItem("videoRecordingEnabled", "invalid");
      expect(loadVideoRecordingEnabled()).toBe(false);
    });

    test("localStorage 抛出异常时回退到默认值", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("localStorage unavailable");
      });

      expect(loadVideoRecordingEnabled()).toBe(DEFAULT_VIDEO_RECORDING_ENABLED);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("saveVideoRecordingEnabled", () => {
    test("可以保存 true", () => {
      saveVideoRecordingEnabled(true);
      expect(localStorage.getItem("videoRecordingEnabled")).toBe("true");
    });

    test("可以保存 false", () => {
      saveVideoRecordingEnabled(false);
      expect(localStorage.getItem("videoRecordingEnabled")).toBe("false");
    });

    test("localStorage 抛出异常时不传播异常", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("localStorage unavailable");
      });

      expect(() => saveVideoRecordingEnabled(false)).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("保存与读取的往返", () => {
    test("能正确读取已保存的值", () => {
      saveVideoRecordingEnabled(false);
      expect(loadVideoRecordingEnabled()).toBe(false);

      saveVideoRecordingEnabled(true);
      expect(loadVideoRecordingEnabled()).toBe(true);
    });
  });
});
