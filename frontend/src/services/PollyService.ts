import i18next from "i18next";
import { getPollyLanguageCode } from "../i18n/utils/languageUtils";
import { ApiService } from "./ApiService";

/**
 * Amazon Polly 服务
 * 进行文本的语音合成
 */
export class PollyService {
  private static instance: PollyService;

  // 默认朗读速度（1.0 为标准，大于 1.0 更快，小于则更慢）
  private defaultSpeechRate: number = 1.25;

  /**
   * 构造函数 - 单例模式
   */
  private constructor() { }

  /**
   * 获取单例实例
   */
  public static getInstance(): PollyService {
    if (!PollyService.instance) {
      PollyService.instance = new PollyService();
    }
    return PollyService.instance;
  }

  /**
   * 设置朗读速度
   * @param rate 速度（1.0 为标准，可在 0.5～2.0 范围内设置）
   */
  public setSpeechRate(rate: number): void {
    this.defaultSpeechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  /**
   * 获取当前朗读速度
   * @returns 当前朗读速度
   */
  public getSpeechRate(): number {
    return this.defaultSpeechRate;
  }

  /**
   * 将文本转换为 SSML（包含朗读速度的调整）
   * @param text 原始文本
   * @param rate 朗读速度（未指定时使用默认值）
   * @returns SSML 格式的文本
   */
  public textToSSML(text: string, rate?: number): string {
    const speechRate = rate || this.defaultSpeechRate;

    // 转义文本（替换 XML 特殊字符）
    const escapedText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    return `<speak><prosody rate="${speechRate}">${escapedText}</prosody></speak>`;
  }

  /**
   * 将文本转换为语音（带 SSML 形式的语速调整）
   * @param text 要转换为语音的文本
   * @param voiceId 语音类型（必填：从场景的 NPC 设置中获取）
   * @param rate 朗读速度（可选：未指定时使用默认值）
   * @returns 语音 URL
   */
  public async synthesizeSpeech(
    text: string,
    voiceId: string,
    rate?: number,
  ): Promise<string> {
    const ssmlText = this.textToSSML(text, rate);
    return this.synthesizeSpeechWithSSML(ssmlText, voiceId);
  }

  /**
   * 将带 SSML 标签的文本转换为语音
   * @param ssmlText 包含 SSML 标签的文本
   * @param voiceId 语音类型（必填：从场景的 NPC 设置中获取）
   * @returns 语音 URL
   */
  public async synthesizeSpeechWithSSML(
    ssmlText: string,
    voiceId: string,
  ): Promise<string> {
    const currentLanguage = i18next.language.split("-")[0] || "zh";
    const languageCode = getPollyLanguageCode(currentLanguage);

    const requestBody = {
      text: ssmlText,
      voiceId,
      languageCode,
      textType: "ssml" as const,
    };

    const apiService = ApiService.getInstance();
    const response = await apiService.callPollyAPI(requestBody);

    if (!response.success || !response.audioUrl) {
      throw new Error(
        response.error || response.message || "获取语音 URL 失败",
      );
    }

    return response.audioUrl;
  }

  /**
   * 将文本转换为语音，同时获取 viseme 数据
   * @param text 要转换为语音的文本
   * @param voiceId 语音类型（必填）
   * @param rate 朗读速度（可选）
   * @returns 语音 URL 与 viseme 数据
   */
  public async synthesizeSpeechWithViseme(
    text: string,
    voiceId: string,
    rate?: number,
  ): Promise<{ audioUrl: string; visemes?: Array<{ time: number; type: string; value: string }> }> {
    const ssmlText = this.textToSSML(text, rate);
    const currentLanguage = i18next.language.split("-")[0] || "zh";
    const languageCode = getPollyLanguageCode(currentLanguage);

    const requestBody = {
      text: ssmlText,
      voiceId,
      languageCode,
      textType: "ssml" as const,
    };

    const apiService = ApiService.getInstance();
    const response = await apiService.callPollyAPI(requestBody);

    if (!response.success || !response.audioUrl) {
      throw new Error(response.error || response.message || "获取语音 URL 失败");
    }

    return {
      audioUrl: response.audioUrl,
      visemes: response.visemes,
    };
  }
}
