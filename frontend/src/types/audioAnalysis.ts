/**
 * 语音分析相关的类型定义
 */

/**
 * 说话者信息
 */
export interface SpeakerInfo {
  speaker_label: string; // Amazon Transcribe 赋予的说话者标签（例：spk_0, spk_1）
  identified_role: string; // 识别出的角色（salesperson, customer, observer）
  confidence: number; // 角色识别的置信度（0.0-1.0）
  sample_utterances: string[]; // 该说话者的代表性发言示例
}

/**
 * 对话片段
 */
export interface ConversationSegment {
  start_time: number; // 开始时间（秒）
  end_time: number; // 结束时间（秒）
  speaker_label: string; // 说话者标签
  text: string; // 发言内容
  role: string; // 识别出的角色
}

/**
 * 语音分析结果
 */
export interface AudioAnalysisResult {
  speakers: SpeakerInfo[]; // 检测到的说话者信息
  segments: ConversationSegment[]; // 时序的对话片段
  summary: {
    total_speakers: number;
    total_segments: number;
    speaker_distribution: Record<string, number>;
    dominant_speaker?: string;
  }; // 分析摘要
  language_detected: string; // 检测到的语言代码
}

/**
 * 语音分析 API 响应
 */
export interface AudioAnalysisApiResponse {
  success: boolean;
  sessionId: string;
  audioAnalysis?: AudioAnalysisResult;
  scenarioId?: string;
  language?: string;
  createdAt?: string;
}

/**
 * 上传 URL 生成响应
 */
export interface AudioUploadUrlResponse {
  success: boolean;
  uploadUrl: string;
  formData: Record<string, string>;
  audioKey: string;
  sessionId: string;
  language: string;
}

/**
 * 分析状态响应
 */
export interface AudioAnalysisStatusResponse {
  success: boolean;
  sessionId: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED';
  currentStep?: 'START' | 'TRANSCRIBING' | 'ANALYZING' | 'SAVING' | 'ERROR';
  hasResult: boolean;
  progress?: {
    currentStep: string;
    status: string;
    updatedAt?: string;
    transcribeJobName?: string;
    error?: string;
  };
}

/**
 * 分析开始响应
 */
export interface AudioAnalysisStartResponse {
  success: boolean;
  sessionId: string;
  executionArn?: string;
  status: 'STARTED' | 'COMPLETED';
  message?: string;
}

/**
 * 语音分析用的语言设置
 */
export type AudioAnalysisLanguage = 'zh' | 'en' | 'ja';

/**
 * 支持的音频格式
 */
export type SupportedAudioFormat = 
  | 'audio/mpeg' 
  | 'audio/mp3' 
  | 'audio/wav' 
  | 'audio/flac' 
  | 'audio/ogg';

/**
 * 音频文件信息
 */
export interface AudioFileInfo {
  file: File;
  fileName: string;
  contentType: SupportedAudioFormat;
  size: number;
}
