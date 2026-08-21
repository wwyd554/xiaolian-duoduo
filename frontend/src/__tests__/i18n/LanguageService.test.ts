import { LanguageService } from "../../services/LanguageService";
import i18next from "i18next";

// モック
jest.mock("i18next", () => ({
  language: "ja",
  changeLanguage: jest.fn().mockResolvedValue("ja"),
}));
describe("LanguageService", () => {
  let languageService: LanguageService;

  beforeEach(() => {
    // localStorage のモック
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // シングルトンインスタンスを取得
    languageService = LanguageService.getInstance();

    // モックのリセット
    jest.clearAllMocks();
  });

  describe("getCurrentLanguage", () => {
    it("Returns current language", () => {
      expect(languageService.getCurrentLanguage()).toBe("ja");
    });
  });

  describe("changeLanguage", () => {
    it("Can change to a supported language", async () => {
      await expect(languageService.changeLanguage("en")).resolves.toBe("en");
      expect(localStorage.setItem).toHaveBeenCalledWith("i18nextLng", "en");
      expect(i18next.changeLanguage).toHaveBeenCalledWith("en");
    });

    it("Rejects unsupported languages", async () => {
      await expect(languageService.changeLanguage("xyz")).rejects.toThrow();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("loadLanguageSettingFromUserProfile", () => {
    it("Loads language settings from local storage", async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue("en");

      await languageService.loadLanguageSettingFromUserProfile();
      expect(i18next.changeLanguage).toHaveBeenCalledWith("en");
    });

    it("Does nothing if no language in storage", async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      await languageService.loadLanguageSettingFromUserProfile();

      expect(i18next.changeLanguage).not.toHaveBeenCalled();
    });
  });
});
