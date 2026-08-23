import { ApiService } from './ApiService';
import {
  AudioAnalysisApiResponse,
  AudioUploadUrlResponse,
  AudioAnalysisStatusResponse,
  AudioAnalysisStartResponse,
  AudioAnalysisLanguage,
  SupportedAudioFormat
} from '../types/audioAnalysis';

/**
 * 语音分析服务
 * 
 * 管理音频文件的上传、分析处理和结果获取。
 * 使用 ApiService 进行 API 调用。
 */
export class AudioAnalysisService {
  private static instance: AudioAnalysisService;
  private apiService: ApiService;

  /**
   * 构造函数 - 单例模式
   */
  private constructor() {
    console.log("=== 音频分析服务初始化 ===");
    this.apiService = ApiService.getInstance();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AudioAnalysisService {
    if (!AudioAnalysisService.instance) {
      AudioAnalysisService.instance = new AudioAnalysisService();
    }
    return AudioAnalysisService.instance;
  }

  /**
   * 生成音频文件上传用的签名 URL
   * 
   * @param fileName 文件名
   * @param contentType 音频文件的格式
   * @param language 语言设置
   * @returns 签名 URL 与会话信息
   */
  async generateUploadUrl(
    fileName: string,
    contentType: SupportedAudioFormat,
    language: AudioAnalysisLanguage
  ): Promise<AudioUploadUrlResponse> {
    try {
      console.log('=== 音频上传URL生成开始 ===');
      console.log(`文件名: ${fileName}, 格式: ${contentType}, 语言: ${language}`);

      const response = await this.apiService.generateAudioUploadUrl(
        fileName,
        contentType,
        language
      );

      console.log('音频上传URL生成完成:', response);
      return response;
    } catch (error) {
      console.error('=== 音频上传URL生成错误 ===');
      console.error('错误详情:', error);
      throw error;
    }
  }

  /**
   * 将音频文件上传到 S3（POST 表单方式）
   * 
   * @param file 音频文件
   * @param uploadUrl 签名 URL
   * @param formData POST 表单用数据
   * @param onProgress 上传进度回调
   */
  async uploadAudioFile(
    file: File,
    uploadUrl: string,
    formData: Record<string, string>,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      console.log('=== 音频文件上传开始（POST表单方式）===');
      console.log(`文件名: ${file.name}, 大小: ${file.size}`);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('音频文件上传完成');
            resolve();
          } else {
            console.error(`上传失败: ${xhr.status} - ${xhr.statusText}`);
            reject(new Error(`上传失败: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('上传时发生错误');
          reject(new Error('上传过程中发生错误'));
        });

        // 创建 FormData 对象
        const formDataObj = new FormData();

        // 添加签名表单数据的字段
        Object.entries(formData).forEach(([key, value]) => {
          formDataObj.append(key, value);
        });

        // 最后添加文件（按 S3 的要求，file 字段放在最后）
        formDataObj.append("file", file);

        xhr.open('POST', uploadUrl);
        // 不设置 Content-Type 头（FormData 会自动设置合适的值）
        xhr.send(formDataObj);
      });
    } catch (error) {
      console.error('=== 音频文件上传错误 ===');
      console.error('错误详情:', error);
      throw error;
    }
  }

  /**
   * 开始语音分析
   * 
   * @param sessionId 会话 ID
   * @param audioKey 音频文件的 S3 键
   * @param scenarioId 场景 ID
   * @param language 语言设置
   * @returns 分析开始结果
   */
  async startAnalysis(
    sessionId: string,
    audioKey: string,
    scenarioId: string,
    language: AudioAnalysisLanguage
  ): Promise<AudioAnalysisStartResponse> {
    try {
      console.log('=== 语音分析开始 ===');
      console.log(`会话ID: ${sessionId}, 场景ID: ${scenarioId}, 语言: ${language}`);

      const response = await this.apiService.startAudioAnalysis(
        sessionId,
        audioKey,
        scenarioId,
        language
      );

      console.log('语音分析开始完成:', response);

      // 使类型匹配
      return {
        success: response.success,
        sessionId: response.sessionId,
        executionArn: response.executionArn,
        status: response.status as AudioAnalysisStartResponse['status'],
        message: response.message
      };
    } catch (error) {
      console.error('=== 音频分析开始错误 ===');
      console.error('错误详情:', error);
      throw error;
    }
  }

  /**
   * 确认语音分析状态
   * 
   * @param sessionId 会话 ID
   * @returns 分析状态
   */
  async getAnalysisStatus(sessionId: string): Promise<AudioAnalysisStatusResponse> {
    try {
      const response = await this.apiService.getAudioAnalysisStatus(sessionId);

      // 使类型匹配
      return {
        success: response.success,
        sessionId: response.sessionId,
        status: response.status as AudioAnalysisStatusResponse['status'],
        currentStep: response.currentStep as AudioAnalysisStatusResponse['currentStep'],
        hasResult: response.hasResult,
        progress: response.progress as unknown as AudioAnalysisStatusResponse['progress']
      };
    } catch (error) {
      console.error('分析状态确认错误:', error);
      throw error;
    }
  }

  /**
   * 获取语音分析结果
   * 
   * @param sessionId 会话 ID
   * @returns 分析结果
   */
  async getAnalysisResults(sessionId: string): Promise<AudioAnalysisApiResponse> {
    try {
      console.log('=== 语音分析结果获取开始 ===');
      console.log(`会话ID: ${sessionId}`);

      const response = await this.apiService.getAudioAnalysisResults(sessionId);

      console.log('语音分析结果获取完成:', response);

      // 使类型匹配
      return {
        success: response.success,
        sessionId: response.sessionId,
        audioAnalysis: response.audioAnalysis as AudioAnalysisApiResponse['audioAnalysis'],
        scenarioId: response.scenarioId,
        language: response.language,
        createdAt: response.createdAt
      };
    } catch (error) {
      console.error('=== 音频分析结果获取错误 ===');
      console.error('错误详情:', error);
      throw error;
    }
  }

  /**
   * 音频文件的校验
   * 
   * @param file 音频文件
   * @param maxSizeInMB 最大文件大小（MB）
   * @returns 校验结果
   */
  validateAudioFile(file: File, maxSizeInMB: number = 100): {
    isValid: boolean;
    error?: string;
    contentType?: SupportedAudioFormat;
  } {
    console.log('=== 音频文件校验开始 ===');
    console.log(`文件名: ${file.name}, 大小: ${file.size}, 类型: ${file.type}`);

    // 文件大小检查
    const maxSize = maxSizeInMB * 1024 * 1024;
    if (file.size > maxSize) {
      console.error(`文件大小超出限制: ${file.size} > ${maxSize}`);
      return {
        isValid: false,
        error: `文件大小请在 ${maxSizeInMB}MB 以下`
      };
    }

    // 音频格式检查
    const supportedTypes: SupportedAudioFormat[] = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/flac',
      'audio/ogg'
    ];

    let contentType: SupportedAudioFormat = 'audio/mpeg';

    // 根据 MIME 类型判断
    if (supportedTypes.includes(file.type as SupportedAudioFormat)) {
      contentType = file.type as SupportedAudioFormat;
    } else {
      // 根据扩展名判断
      const extension = file.name.toLowerCase().split('.').pop();
      const extensionMap: Record<string, SupportedAudioFormat> = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg'
      };

      if (extension && extensionMap[extension]) {
        contentType = extensionMap[extension];
        console.log(`根据扩展名判断格式: ${extension} -> ${contentType}`);
      } else {
        console.error(`不支持的音频格式: ${file.type}, 扩展名: ${extension}`);
        return {
          isValid: false,
          error: '不支持的音频格式。请使用 MP3、WAV、FLAC、OGG 格式'
        };
      }
    }

    console.log('音频文件校验完成:', { contentType });
    return {
      isValid: true,
      contentType
    };
  }

  /**
   * 通过轮询监控分析进度
   * 
   * @param sessionId 会话 ID
   * @param onProgress 进度更新回调
   * @param maxAttempts 最大尝试次数
   * @param intervalMs 轮询间隔（毫秒）
   * @returns 最终分析结果
   */
  async pollAnalysisStatus(
    sessionId: string,
    onProgress: (status: AudioAnalysisStatusResponse) => void,
    maxAttempts: number = 120, // 最长 20 分钟（10 秒间隔 × 120 次）
    intervalMs: number = 10000 // 10 秒间隔
  ): Promise<AudioAnalysisApiResponse> {
    let attempts = 0;

    console.log('=== 音频分析轮询开始 ===');
    console.log(`会话ID: ${sessionId}, 最大尝试次数: ${maxAttempts}, 间隔: ${intervalMs}ms`);

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          console.log(`轮询尝试: ${attempts}/${maxAttempts}`);

          const status = await this.getAnalysisStatus(sessionId);
          onProgress(status);

          if (status.status === 'COMPLETED') {
            console.log('音频分析完成 - 正在获取结果');
            // 完成时获取结果并返回
            const result = await this.getAnalysisResults(sessionId);
            console.log('语音分析结果获取完成');
            resolve(result);
            return;
          } else if (status.status === 'FAILED' || status.currentStep === 'ERROR') {
            console.error('语音分析失败:', status.progress?.error);
            reject(new Error(`分析失败: ${status.progress?.error || '详情未知'}`));
            return;
          } else if (attempts >= maxAttempts) {
            console.error('音频分析轮询超时');
            reject(new Error('分析超时'));
            return;
          }

          // 若尚未完成，则安排下一次轮询
          setTimeout(poll, intervalMs);

        } catch (error) {
          console.error('轮询中出错:', error);
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * 执行语音分析（从上传到获取结果的集成处理）
   * 
   * @param file 音频文件
   * @param scenarioId 场景 ID
   * @param language 语言设置
   * @param onUploadProgress 上传进度回调
   * @param onAnalysisProgress 分析进度回调
   * @returns 分析结果
   */
  async executeFullAnalysis(
    file: File,
    scenarioId: string,
    language: AudioAnalysisLanguage,
    onUploadProgress?: (progress: number) => void,
    onAnalysisProgress?: (status: AudioAnalysisStatusResponse) => void
  ): Promise<AudioAnalysisApiResponse> {
    try {
      console.log('=== 语音分析集成处理开始 ===');

      // 1. 文件校验
      const validation = this.validateAudioFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error || '文件校验失败');
      }

      // 2. 生成上传 URL
      const uploadInfo = await this.generateUploadUrl(
        file.name,
        validation.contentType!,
        language
      );

      // 3. 文件上传（POST 表单方式）
      await this.uploadAudioFile(
        file,
        uploadInfo.uploadUrl,
        (uploadInfo as AudioUploadUrlResponse & { formData: Record<string, string> }).formData, // POST 表单用数据
        onUploadProgress
      );

      // 4. 开始分析
      const analysisStart = await this.startAnalysis(
        uploadInfo.sessionId,
        uploadInfo.audioKey,
        scenarioId,
        language
      );

      if (!analysisStart.success) {
        throw new Error(analysisStart.message || '开始分析失败');
      }

      // 5. 通过轮询监控结果
      const result = await this.pollAnalysisStatus(
        uploadInfo.sessionId,
        onAnalysisProgress || (() => { })
      );

      console.log('=== 语音分析集成处理完成 ===');
      return result;

    } catch (error) {
      console.error('=== 音频分析集成处理错误 ===');
      console.error('错误详情:', error);

      if (error instanceof Error) {
        throw new Error(`语音分析处理失败: ${error.message}`);
      } else {
        throw new Error('语音分析处理失败');
      }
    }
  }
}
