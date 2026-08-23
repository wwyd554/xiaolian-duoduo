import {
  languageNameMapping,
  supportedLanguages,
  getPollyLanguageCode,
} from "../../i18n/utils/languageUtils";

describe("languageUtils", () => {
  describe("languageNameMapping", () => {
    it("返回日文的显示名", () => {
      expect(languageNameMapping["ja"]).toBe("日本語");
    });

    it("返回英文的显示名", () => {
      expect(languageNameMapping["en"]).toBe("English");
    });
  });

  describe("supportedLanguages", () => {
    it("包含支持的语言", () => {
      expect(supportedLanguages).toContain("zh");
      expect(supportedLanguages).toContain("en");
    });
  });

  describe("getPollyLanguageCode", () => {
    it("返回日文的正确 Polly 语言代码", () => {
      expect(getPollyLanguageCode("ja")).toBe("ja-JP");
    });

    it("返回英文的正确 Polly 语言代码", () => {
      expect(getPollyLanguageCode("en")).toBe("en-US");
    });

    it("不支持的语言返回默认值", () => {
      expect(getPollyLanguageCode("xyz")).toBe("cmn-CN");
    });
  });
});
