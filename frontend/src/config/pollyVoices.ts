/**
 * Amazon Polly 语音模型定义
 * 按语言区分的 neural/generative 模型列表
 */

/** 语音模型信息 */
export interface PollyVoiceModel {
  voiceId: string;
  displayName: string;
  gender: 'male' | 'female' | 'male_child' | 'female_child';
  engines: ('neural' | 'generative')[];
}

/** 按语言区分的语音模型列表 */
export const POLLY_VOICES: Record<string, PollyVoiceModel[]> = {
  ja: [
    { voiceId: 'Takumi', displayName: 'Takumi', gender: 'male', engines: ['neural'] },
    { voiceId: 'Kazuha', displayName: 'Kazuha', gender: 'female', engines: ['neural'] },
    { voiceId: 'Tomoko', displayName: 'Tomoko', gender: 'female', engines: ['neural'] },
  ],
  en: [
    { voiceId: 'Danielle', displayName: 'Danielle', gender: 'female', engines: ['neural', 'generative'] },
    { voiceId: 'Gregory', displayName: 'Gregory', gender: 'male', engines: ['neural'] },
    { voiceId: 'Ivy', displayName: 'Ivy', gender: 'female_child', engines: ['neural'] },
    { voiceId: 'Joanna', displayName: 'Joanna', gender: 'female', engines: ['neural', 'generative'] },
    { voiceId: 'Kendra', displayName: 'Kendra', gender: 'female', engines: ['neural'] },
    { voiceId: 'Kimberly', displayName: 'Kimberly', gender: 'female', engines: ['neural'] },
    { voiceId: 'Salli', displayName: 'Salli', gender: 'female', engines: ['neural', 'generative'] },
    { voiceId: 'Joey', displayName: 'Joey', gender: 'male', engines: ['neural'] },
    { voiceId: 'Justin', displayName: 'Justin', gender: 'male_child', engines: ['neural'] },
    { voiceId: 'Kevin', displayName: 'Kevin', gender: 'male_child', engines: ['neural'] },
    { voiceId: 'Matthew', displayName: 'Matthew', gender: 'male', engines: ['neural', 'generative'] },
    { voiceId: 'Ruth', displayName: 'Ruth', gender: 'female', engines: ['neural', 'generative'] },
    { voiceId: 'Stephen', displayName: 'Stephen', gender: 'male', engines: ['neural', 'generative'] },
  ],
};

/**
 * generative 支持模型的集合（用于后端引擎的自动选择）
 * 重要: 需要与后端 cdk/lambda/textToSpeech/app.ts 的 GENERATIVE_VOICE_IDS 保持同步
 */
export const GENERATIVE_VOICE_IDS = new Set(
  Object.values(POLLY_VOICES)
    .flat()
    .filter((v) => v.engines.includes('generative'))
    .map((v) => v.voiceId)
);

/**
 * 获取指定语言的语音模型列表
 */
export const getVoicesForLanguage = (languageCode: string): PollyVoiceModel[] => {
  const lang = languageCode.split('-')[0];
  return POLLY_VOICES[lang] || [];
};

/**
 * 根据 voiceId 自动选择引擎（优先使用 generative）
 */
export const getPreferredEngine = (voiceId: string): 'generative' | 'neural' => {
  return GENERATIVE_VOICE_IDS.has(voiceId) ? 'generative' : 'neural';
};
