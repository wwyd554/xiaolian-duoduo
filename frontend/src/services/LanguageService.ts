import i18next from "i18next";
import { supportedLanguages } from "../i18n/utils/languageUtils";

/**
 * Language Service provides operations for language settings
 * - Language persistence (localStorage)
 * - User language settings retrieval
 */
export class LanguageService {
  private static instance: LanguageService;

  /**
   * Constructor - Singleton pattern
   */
  private constructor() {
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  /**
   * Get current language setting
   */
  public getCurrentLanguage(): string {
    return i18next.language || "zh";
  }

  /**
   * Change language
   * @param languageCode New language code
   */
  public async changeLanguage(languageCode: string): Promise<string> {
    if (!supportedLanguages.includes(languageCode)) {
      throw new Error(`Unsupported language code: ${languageCode}`);
    }

    // Save language setting to localStorage
    localStorage.setItem("i18nextLng", languageCode);

    // Change language in i18next
    await i18next.changeLanguage(languageCode);

    return languageCode;
  }

  /**
   * Load language settings from local storage
   */
  public async loadLanguageSettingFromUserProfile(): Promise<void> {
    try {
      // Load language settings from localStorage
      const savedLanguage = localStorage.getItem("i18nextLng");

      if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
        await i18next.changeLanguage(savedLanguage);
      }
    } catch (error) {
      console.error("Error loading language settings:", error);
      // Keep current language on error
    }
  }
}
