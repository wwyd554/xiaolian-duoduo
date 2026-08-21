/**
 * 言語コードとAmazon Polly用のlanguageCodeのマッピング
 */
const languageToPollyCodeMapping: Record<string, string> = {
  zh: "cmn-CN",
  en: "en-US",
  ja: "ja-JP",
};

/**
 * 言語コードと表示名のマッピング
 */
export const languageNameMapping: Record<string, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
};

/**
 * サポートされている言語コードのリスト
 */
export const supportedLanguages = ["zh", "en"];

/**
 * 言語コードからAmazon Polly用のlanguageCodeを取得
 */
export const getPollyLanguageCode = (languageCode: string): string => {
  return languageToPollyCodeMapping[languageCode] || "cmn-CN";
};
