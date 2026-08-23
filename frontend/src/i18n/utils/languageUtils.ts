/**
 * 语言代码与 Amazon Polly 用 languageCode 的映射
 */
const languageToPollyCodeMapping: Record<string, string> = {
  zh: "cmn-CN",
  en: "en-US",
  ja: "ja-JP",
};

/**
 * 语言代码与显示名的映射
 */
export const languageNameMapping: Record<string, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
};

/**
 * 支持的语言代码列表
 */
export const supportedLanguages = ["zh", "en"];

/**
 * 从语言代码获取 Amazon Polly 用 languageCode
 */
export const getPollyLanguageCode = (languageCode: string): string => {
  return languageToPollyCodeMapping[languageCode] || "cmn-CN";
};
