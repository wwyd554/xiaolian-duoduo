// 本地 FastAPI 后端 —— 邀请码制认证（替代原 aws-amplify API 客户端）
import { LOCAL_BACKEND_URL, loadAuth } from "./LocalAuth";
import type { Message, Metrics, NPC, Goal, GoalStatus } from "../types/index";
import type {
  FeedbackAnalysisResult,
  SessionInfo,
  ScenarioInfo,
  SessionListResponse,
  MessageListResponse,
  ScenarioListResponse,
  ComplianceCheck,
  ScenarioExportData,
  ImportResponse,
  SessionCompleteDataResponse,
} from "../types/api";
import { mergeGoalStatus, serializeGoalStatus } from "../utils/goalUtils";
import {
  transformImportResponse,
  transformVideoAnalysisResult,
  transformComplianceViolation,
} from "../utils/apiTransformers";

/**
 * 本地 FastAPI 通信服务。
 */
export class ApiService {
  private static instance: ApiService;

  /**
   * 本地后端一次对话返回完整结果（回复+评分）。
   * chatWithNPC 缓存后，getRealtimeEvaluation 直接消费，避免二次调用后端。
   */
  private lastConversationResult: {
    success: boolean;
    response: string;
    sessionId: string;
    messageId: string;
    metrics: Metrics;
    analysis: string;
    goalUpdates: Array<{ goalId: string; achieved: boolean; reason?: string }>;
    suggestions: string[];
    npcEmotion: string;
    npcEmotionIntensity: number;
    gesture: string;
    sessionCompleted: boolean;
    turnsUsed: number;
    maxTurns: number;
  } | null = null;

  private constructor() { }

  /**
   * 获取单例实例
   */
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * 获取认证令牌（本地邀请码制 JWT）
   * @returns 包含认证头部的对象
   * @throws Error - 认证错误时
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const auth = loadAuth();
    if (!auth?.token) {
      console.error("认证错误: 未登录或登录已过期");
      throw new Error("用户未登录，请先使用邀请码登录。");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    };
  }

  /**
   * 本地 FastAPI 通用请求（fetch 直连 LOCAL_BACKEND_URL）
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${LOCAL_BACKEND_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      // FastAPI 错误体: {"detail": "..."}
      const errText = await response.text().catch(() => "");
      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed && typeof parsed === "object" && "detail" in parsed) {
          detail = String(parsed.detail);
        }
      } catch {
        // 非 JSON 错误体，原样使用
      }
      throw new Error(detail || `HTTP ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return "success" as T;
    }
    return (await response.json()) as T;
  }

  /**
   * 执行 API GET 请求
   * @param path API 路径
   * @param queryParams 查询参数
   * @returns 响应
   */
  private async apiGet<T>(
    path: string,
    queryParams?: Record<string, string | number>,
  ): Promise<T> {
    try {
      // 构建查询参数字符串
      let queryString = "";
      if (queryParams) {
        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        });
        queryString = params.toString();
      }

      const fullPath = queryString ? `${path}?${queryString}` : path;
      return await this.request<T>("GET", fullPath);
    } catch (error) {
      console.error(`API GET 错误 (${path}):`, error);
      throw error;
    }
  }

  /**
   * 执行 API POST 请求
   * @param path API 路径
   * @param requestBody 请求体
   * @returns 响应
   */
  private async apiPost<T, R = unknown>(
    path: string,
    requestBody: R,
  ): Promise<T> {
    try {
      return await this.request<T>("POST", path, requestBody);
    } catch (error) {
      console.error(`API POST 错误 (${path}):`, error);
      throw error;
    }
  }

  /**
   * 执行 API PUT 请求
   * @param path API 路径
   * @param requestBody 请求体
   * @returns 响应
   */
  private async apiPut<T, R = unknown>(
    path: string,
    requestBody: R,
  ): Promise<T> {
    try {
      return await this.request<T>("PUT", path, requestBody);
    } catch (error) {
      console.error(`API PUT 错误 (${path}):`, error);
      throw error;
    }
  }

  /**
   * 执行 API DELETE 请求
   * @param path API 路径
   * @returns 响应
   */
  private async apiDelete<T>(path: string): Promise<T> {
    try {
      return await this.request<T>("DELETE", path);
    } catch (error) {
      console.error(`API DELETE 错误 (${path}):`, error);
      throw error;
    }
  }

  /**
   * 创建或更新会话
   * 
   * 创建或更新本地会话记录。
   * 
   * @param sessionId 会话 ID
   * @param scenarioId 场景 ID
   * @param title 会话标题（可选）
   * @param npcInfo NPC 信息（可选）
   * @returns 创建结果
   */
  public async createOrUpdateSession(
    sessionId: string,
    scenarioId: string,
    title?: string,
    npcInfo?: {
      name: string;
      role: string;
      company: string;
      personality?: string[];
      description?: string;
    }
  ): Promise<{ success: boolean; sessionId: string; isNew: boolean }> {
    try {
      const requestBody: Record<string, unknown> = {
        sessionId,
        scenarioId,
      };

      if (title) {
        requestBody.title = title;
      }

      if (npcInfo) {
        requestBody.npcInfo = npcInfo;
      }

      const response = await this.apiPost<{
        success: boolean;
        sessionId: string;
        message: string;
        isNew: boolean;
      }>("/sessions", requestBody);

      return {
        success: response.success,
        sessionId: response.sessionId,
        isNew: response.isNew,
      };
    } catch (error) {
      console.error("会话创建/更新错误:", error);
      // 即使发生错误也要保证对话可继续
      return {
        success: false,
        sessionId,
        isNew: false,
      };
    }
  }

  /**
   * 完成一场陪练，并让后端开始生成复盘报告。
   */
  public async completeSession(sessionId: string): Promise<{
    success: boolean;
    sessionId: string;
    status: "completed";
    message: string;
  }> {
    return this.apiPost(`/sessions/${sessionId}/complete`, {});
  }

  /**
   * 与 NPC 对话（本地 FastAPI 单次调用，回复+评分一次返回）
   *
   * @param message 用户消息
   * @param npc NPC 信息
   * @param previousMessages 过去的消息历史（后端从 SQLite 读取，未使用）
   * @param sessionId 会话 ID
   * @param messageId 消息 ID
   * @param emotionParams 情感参数
   * @param scenarioId 场景 ID
   * @param language 语言设置
   * @returns NPC 的响应
   */
  public async chatWithNPC(
    message: string,
    npc: NPC,
    _previousMessages: Message[],
    sessionId?: string,
    messageId?: string,
    emotionParams?: {
      angerLevel?: number;
      trustLevel?: number;
      progressLevel?: number;
    },
    scenarioId?: string,
    language?: string,
    _presentedSlides?: Array<{ pageNumber: number; imageKey: string }>,
  ): Promise<{ response: string; sessionId: string; messageId: string }> {
    void _presentedSlides;
    try {
      const auth = loadAuth();
      if (!auth) {
        throw new Error("用户未登录");
      }
      const currentSessionId = sessionId || crypto.randomUUID();

      const body: Record<string, unknown> = {
        content: message,
        language: language || "zh",
      };
      // NPC 信息（后端优先使用请求传入；缺失时回退会话/场景）
      if (npc) {
        body.npcInfo = {
          name: npc.name,
          role: npc.role,
          company: npc.company,
          personality: npc.personality,
          description: npc.description,
        };
      }
      if (emotionParams && (emotionParams.angerLevel || emotionParams.trustLevel || emotionParams.progressLevel)) {
        body.emotionParams = {
          angerLevel: emotionParams.angerLevel || 1,
          trustLevel: emotionParams.trustLevel || 1,
          progressLevel: emotionParams.progressLevel || 1,
        };
      }

      const result = await this.request<{
        success: boolean;
        response: string;
        sessionId: string;
        messageId: string;
        metrics: Metrics;
        analysis: string;
        goalUpdates: Array<{ goalId: string; achieved: boolean; reason?: string }>;
        suggestions: string[];
        npcEmotion: string;
        npcEmotionIntensity: number;
        gesture: string;
        sessionCompleted: boolean;
        turnsUsed: number;
        maxTurns: number;
      }>("POST", `/sessions/${currentSessionId}/messages`, body);

      // 缓存完整结果，供 getRealtimeEvaluation 消费
      this.lastConversationResult = result;

      return {
        response: result.response || "",
        sessionId: result.sessionId || currentSessionId,
        messageId: result.messageId || messageId || crypto.randomUUID(),
      };
    } catch (error: unknown) {
      console.error("与NPC对话时发生错误:", error);
      // 出错时的兜底响应
      return {
        response:
          "抱歉，回复生成时出现错误，请稍后重试。",
        sessionId: sessionId || "",
        messageId: messageId || "",
      };
    }
  }

  /**
   * 获取实时评估（本地版：直接从 chatWithNPC 缓存的结果中取评分）
   *
   * 后端已在单次 /sessions/{id}/messages 调用中完成评分，
   * 此处仅消费缓存并转换为前端 goalStatuses 格式，不发起新的后端请求。
   *
   * @param message 用户消息
   * @param previousMessages 过去的消息历史（未使用）
   * @param sessionId 会话 ID
   * @param goalStatuses 当前目标达成情况（可选）
   * @param goals 场景的目标定义（可选）
   * @param scenarioId 场景 ID（未使用）
   * @param language 语言设置（可选）
   * @param currentScores 当前得分（可选）
   * @param scenarioDescription 场景说明（未使用）
   * @returns 包含指标与目标状态的对象
   */
  public async getRealtimeEvaluation(
    message: string,
    _previousMessages: Message[],
    sessionId?: string,
    goalStatuses?: GoalStatus[],
    _goals?: Goal[],
    _scenarioId?: string,
    _language?: string,
    currentScores?: {
      angerLevel: number;
      trustLevel: number;
      progressLevel: number;
    },
    _scenarioDescription?: string,
  ): Promise<{
    scores?: {
      angerLevel: number;
      trustLevel: number;
      progressLevel: number;
    };
    analysis?: string;
    goalStatuses?: GoalStatus[];
    compliance?: ComplianceCheck;
    npcEmotion?: string;
    npcEmotionIntensity?: number;
    gesture?: string;
    suggestions?: string[];
  }> {
    void _scenarioDescription;
    try {
      const result = this.lastConversationResult;
      if (!result || result.sessionId !== sessionId) {
        console.warn(
          "getRealtimeEvaluation 未找到对应的对话结果缓存（session 不匹配或尚未发送消息）",
        );
        return {
          scores: currentScores
            ? { ...currentScores }
            : { angerLevel: 1, trustLevel: 1, progressLevel: 1 },
          analysis: "",
          compliance: undefined,
        };
      }

      // goalUpdates → goalStatuses 转换（与当前前端状态合并）
      let convertedGoalStatuses: GoalStatus[] | undefined;
      if (Array.isArray(result.goalUpdates)) {
        const currentStatusMap = new Map(
          (goalStatuses || []).map((s) => [s.goalId, s]),
        );
        convertedGoalStatuses = result.goalUpdates.map((update) => {
          const currentStatus = currentStatusMap.get(update.goalId);
          const updateStatus: GoalStatus = {
            goalId: update.goalId,
            progress: update.achieved ? 100 : 0,
            achieved: update.achieved,
            reason: update.reason || "",
          };
          if (currentStatus) {
            return mergeGoalStatus(currentStatus, updateStatus);
          }
          return updateStatus;
        });
      }

      return {
        scores: {
          angerLevel: result.metrics?.angerLevel || 1,
          trustLevel: result.metrics?.trustLevel || 1,
          progressLevel: result.metrics?.progressLevel || 1,
        },
        analysis: result.analysis || "",
        goalStatuses: convertedGoalStatuses,
        npcEmotion: result.npcEmotion || "neutral",
        npcEmotionIntensity: result.npcEmotionIntensity ?? 0.5,
        gesture: result.gesture || "none",
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      };
    } catch (error) {
      console.error("实时评估获取错误:", error);
      return {
        scores: {
          angerLevel: 1,
          trustLevel: 1,
          progressLevel: 1,
        },
        analysis: "",
        compliance: undefined,
      };
    }
  }

  /**
   * 获取会话列表
   * @param limit 获取的最大数量
   * @param nextToken 下一页的令牌
   * @param scenarioId 按场景 ID 过滤
   * @returns 会话列表响应
   */
  public async getSessions(
    limit?: number,
    nextToken?: string,
    scenarioId?: string,
  ): Promise<SessionListResponse> {
    try {
      // 创建查询参数
      const queryParams: Record<string, string | number> = {};

      if (limit !== undefined) {
        queryParams.limit = limit;
      }
      if (nextToken !== undefined) {
        queryParams.nextToken = nextToken;
      }
      if (scenarioId !== undefined) {
        queryParams.scenarioId = scenarioId;
      }

      // API 调用
      return await this.apiGet<SessionListResponse>("/sessions", queryParams);
    } catch (error) {
      console.error("获取会话列表失败:", error);

      if (error instanceof Error) {
        throw new Error(`获取会话列表失败: ${error.message}`);
      } else {
        throw new Error("获取会话列表失败");
      }
    }
  }

  /**
   * 获取会话详情
   * @param sessionId 会话 ID
   * @returns 会话详细信息
   */
  public async getSessionDetail(sessionId: string): Promise<SessionInfo> {
    try {
      // API 调用
      return await this.apiGet<SessionInfo>(`/sessions/${sessionId}`);
    } catch (error) {
      console.error(
        `获取会话详情失败 (${sessionId}):`,
        error,
      );

      if (error instanceof Error) {
        throw new Error(`获取会话详情失败: ${error.message}`);
      } else {
        throw new Error("获取会话详情失败");
      }
    }
  }

  /**
   * 获取会话消息历史
   * @param sessionId 会话 ID
   * @param limit 获取的最大数量
   * @param nextToken 下一页的令牌
   * @returns 消息历史响应
   */
  public async getSessionMessages(
    sessionId: string,
    limit?: number,
    nextToken?: string,
  ): Promise<MessageListResponse> {
    try {
      // 创建查询参数
      const queryParams: Record<string, string | number> = {};

      if (limit !== undefined) {
        queryParams.limit = limit;
      }
      if (nextToken !== undefined) {
        queryParams.nextToken = nextToken;
      }

      // API 调用
      return await this.apiGet<MessageListResponse>(
        `/sessions/${sessionId}/messages`,
        queryParams,
      );
    } catch (error) {
      console.error(
        `获取消息历史失败 (${sessionId}):`,
        error,
      );

      if (error instanceof Error) {
        throw new Error(`获取消息历史失败: ${error.message}`);
      } else {
        throw new Error("获取消息历史失败");
      }
    }
  }

  /**
   * 获取场景列表
   * @param category 按分类过滤
   * @param difficulty 按难度过滤
   * @param limit 获取的最大数量
   * @param nextToken 下一页的令牌
   * @returns 场景列表响应
   */
  public async getScenarios(
    category?: string,
    difficulty?: string,
    limit?: number,
    nextToken?: string,
  ): Promise<ScenarioListResponse> {
    try {
      // 创建查询参数
      const queryParams: Record<string, string | number> = {};

      if (category !== undefined) {
        queryParams.category = category;
      }
      if (difficulty !== undefined) {
        queryParams.difficulty = difficulty;
      }
      if (limit !== undefined) {
        queryParams.limit = limit;
      }
      if (nextToken !== undefined) {
        queryParams.nextToken = nextToken;
      }

      // API 调用
      return await this.apiGet<ScenarioListResponse>("/scenarios", queryParams);
    } catch (error) {
      console.error("获取场景列表失败:", error);

      if (error instanceof Error) {
        throw new Error(`获取场景列表失败: ${error.message}`);
      } else {
        throw new Error("获取场景列表失败");
      }
    }
  }

  /**
   * 获取场景详情
   * @param scenarioId 场景 ID
   * @returns 场景详细信息
   */
  public async getScenarioDetail(scenarioId: string): Promise<ScenarioInfo> {
    try {
      // API 调用
      return await this.apiGet<ScenarioInfo>(`/scenarios/${scenarioId}`);
    } catch (error) {
      console.error(`获取场景详情失败 (${scenarioId}):`, error);

      if (error instanceof Error) {
        throw new Error(`获取场景详情失败: ${error.message}`);
      } else {
        throw new Error("获取场景详情失败");
      }
    }
  }

  /**
   * 获取文件上传用的签名 URL（通用）
   *
   * @param scenarioId 场景 ID
   * @param fileName 文件名
   * @param contentType MIME 类型
   * @returns 签名 URL 信息
   */
  private async getFileUploadUrl(
    scenarioId: string,
    fileName: string,
    contentType: string,
  ): Promise<{
    uploadUrl: string;
    formData: Record<string, string>;
    key: string;
    fileName: string;
    contentType: string;
  }> {
    try {
      const response = await this.apiPost<{
        uploadUrl: string;
        formData: Record<string, string>;
        key: string;
        fileName: string;
        contentType: string;
      }>(`/scenarios/${scenarioId}/pdf-upload-url`, {
        fileName,
        contentType,
      });

      return response;
    } catch (error) {
      console.error("获取文件上传 URL 失败:", error);

      if (error instanceof Error) {
        throw new Error(
          `获取文件上传 URL 失败: ${error.message}`,
        );
      } else {
        throw new Error("获取文件上传 URL 失败");
      }
    }
  }

  /**
   * 上传文件（通用）
   *
   * @param uploadUrl S3 端点 URL
   * @param formData POST 请求用的表单数据
   * @param content 要上传的内容（File 或 Blob）
   * @param contentType 文件的 MIME 类型
   * @returns 上传结果
   */
  private async uploadFile(
    uploadUrl: string,
    formData: Record<string, string>,
    content: File | Blob | string,
    contentType: string,
  ): Promise<void> {
    try {
      // 创建 FormData 对象
      const formDataObj = new FormData();

      // 添加签名表单数据的字段
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, value);
      });

      // 最后添加文件（按 S3 的要求，file 字段放在最后）
      if (typeof content === "string") {
        // 字符串则先转换为 Blob 再上传
        const blob = new Blob([content], { type: contentType });
        formDataObj.append("file", blob);
      } else {
        // 直接添加 File/Blob 对象
        formDataObj.append("file", content);
      }

      // 使用 POST 方法发送表单数据（避免预检请求）
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formDataObj,
        // 不设置 Content-Type 头（FormData 会自动设置合适的值）
        // 这样可完全避免预检请求
      });

      // 检查响应的状态
      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "响应读取错误");
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}. ${errorText}`,
        );
      }
    } catch (error) {
      console.error("文件上传失败:", error);

      if (error instanceof Error) {
        // 若为 CORS 错误，提供更易懂的错误信息
        if (
          error.message.includes("CORS") ||
          error.message.includes("Access-Control")
        ) {
          throw new Error(
            "文件上传时发生 CORS 错误。可能是 S3 表单上传处理出错。",
          );
        }
        throw new Error(
          `文件上传失败: ${error.message}`,
        );
      } else {
        throw new Error("文件上传失败");
      }
    }
  }

  /**
   * 获取 PDF 资料上传用的签名 URL
   *
   * @param scenarioId 场景 ID
   * @param fileName 文件名
   * @param contentType MIME 类型
   * @returns 签名 URL 信息
   */
  public async getPdfUploadUrl(
    scenarioId: string,
    fileName: string,
    contentType: string,
  ): Promise<{
    uploadUrl: string;
    formData: Record<string, string>;
    key: string;
    fileName: string;
    contentType: string;
  }> {
    return this.getFileUploadUrl(scenarioId, fileName, contentType);
  }

  /**
   * 上传 PDF 文件
   *
   * @param uploadUrl 签名上传 URL
   * @param file 要上传的文件
   * @param contentType 文件的 MIME 类型
   * @returns 上传结果
   */
  public async uploadPdfFile(
    uploadUrl: string,
    formData: Record<string, string>,
    file: File,
    contentType: string,
  ): Promise<void> {
    return this.uploadFile(uploadUrl, formData, file, contentType);
  }

  /**
   * 获取 PDF 元数据文件用的签名 URL
   *
   * @param scenarioId 场景 ID
   * @param fileName 元数据文件名（例：filename.metadata.json）
   * @returns 签名 URL 信息
   */
  public async getPdfMetadataUploadUrl(
    scenarioId: string,
    fileName: string,
  ): Promise<{
    uploadUrl: string;
    formData: Record<string, string>;
    key: string;
    fileName: string;
    contentType: string;
  }> {
    return this.getFileUploadUrl(scenarioId, fileName, "application/json");
  }

  /**
   * 上传 PDF 元数据文件
   *
   * @param uploadUrl 签名上传 URL
   * @param metadataContent 元数据的 JSON 内容
   * @returns 上传结果
   */
  public async uploadPdfMetadata(
    uploadUrl: string,
    formData: Record<string, string>,
    metadataContent: object,
  ): Promise<void> {
    return this.uploadFile(
      uploadUrl,
      formData,
      JSON.stringify(metadataContent),
      "application/json",
    );
  }

  /**
   * 删除 PDF 文件与元数据文件
   *
   * @param scenarioId 场景 ID
   * @param fileName PDF 文件名
   * @returns 删除结果
   */
  public async deletePdfWithMetadata(
    scenarioId: string,
    fileName: string,
  ): Promise<{
    success: boolean;
    deletedFiles: string[];
    errors?: string[];
  }> {
    try {
      // 待删除文件的列表
      const filesToDelete = [
        fileName, // PDF 文件
        `${fileName}.metadata.json`, // 元数据文件
      ];

      const deletedFiles: string[] = [];
      const errors: string[] = [];

      // 逐个删除文件
      for (const fileToDelete of filesToDelete) {
        try {
          await this.apiDelete<{ message: string }>(
            `/scenarios/${scenarioId}/files/${encodeURIComponent(fileToDelete)}`,
          );
          deletedFiles.push(fileToDelete);
        } catch (error) {
          console.error(`文件删除错误 (${fileToDelete}):`, error);
          errors.push(
            `${fileToDelete}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return {
        success: deletedFiles.length > 0,
        deletedFiles,
        ...(errors.length > 0 ? { errors } : {}),
      };
    } catch (error) {
      console.error(
        "删除 PDF 文件和元数据文件失败:",
        error,
      );

      if (error instanceof Error) {
        throw new Error(
          `删除 PDF 文件和元数据文件失败: ${error.message}`,
        );
      } else {
        throw new Error("删除 PDF 文件和元数据文件失败");
      }
    }
  }

  // ========================================
  // 提案资料（演示文稿）相关方法
  // ========================================

  /**
   * 获取提案资料 PDF 上传用的签名 URL
   */
  public async getPresentationUploadUrl(
    scenarioId: string,
    fileName: string,
    contentType: string,
  ): Promise<{
    uploadUrl: string;
    formData: Record<string, string>;
    key: string;
    fileName: string;
    contentType: string;
  }> {
    try {
      return await this.apiPost<
        {
          uploadUrl: string;
          formData: Record<string, string>;
          key: string;
          fileName: string;
          contentType: string;
        },
        { fileName: string; contentType: string }
      >(`/scenarios/${scenarioId}/presentation-upload-url`, {
        fileName,
        contentType,
      });
    } catch (error) {
      console.error("演示资料上传URL获取错误:", error);
      throw new Error("获取提案资料上传 URL 失败");
    }
  }

  /**
   * 上传提案资料 PDF
   */
  public async uploadPresentationFile(
    uploadUrl: string,
    formData: Record<string, string>,
    file: File,
  ): Promise<void> {
    return this.uploadFile(uploadUrl, formData, file, "application/pdf");
  }

  /**
   * 删除提案资料
   */
  public async deletePresentationFile(
    scenarioId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await this.apiDelete<{ success: boolean; message: string }>(
        `/scenarios/${scenarioId}/presentation`,
      );
    } catch (error) {
      console.error("演示资料删除错误:", error);
      throw new Error("删除提案资料失败");
    }
  }

  /**
   * 获取幻灯片图片列表（带签名 URL）
   */
  public async getSlideImages(
    scenarioId: string,
  ): Promise<{
    success: boolean;
    scenarioId: string;
    status: string;
    totalPages: number;
    slides: Array<{
      pageNumber: number;
      imageKey: string;
      imageUrl: string;
      thumbnailUrl?: string;
    }>;
  }> {
    try {
      return await this.apiGet(`/scenarios/${scenarioId}/slides`);
    } catch (error) {
      console.error("幻灯片图片列表获取错误:", error);
      throw new Error("获取幻灯片图片失败");
    }
  }

  /**
   * 触发 PDF→幻灯片图片转换
   */
  public async triggerSlideConversion(
    scenarioId: string,
    pdfKey: string,
    fileName: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await this.apiPost<
        { success: boolean; message: string },
        { pdfKey: string; fileName: string }
      >(`/scenarios/${scenarioId}/convert-slides`, { pdfKey, fileName });
    } catch (error) {
      console.error("幻灯片转换触发错误:", error);
      throw new Error("开始幻灯片转换失败");
    }
  }

  /**
   * 导出单个场景
   * @param scenarioId 要导出的场景 ID
   * @returns 场景数据的 JSON 对象
   */
  public async exportScenario(scenarioId: string): Promise<ScenarioExportData> {
    try {
      // API 调用
      return await this.apiGet<ScenarioExportData>(
        `/scenarios/${scenarioId}/export`,
      );
    } catch (error) {
      console.error("场景导出失败:", error);

      if (error instanceof Error) {
        throw new Error(
          `场景导出失败: ${error.message}`,
        );
      } else {
        throw new Error("场景导出失败");
      }
    }
  }

  /**
   * 导入场景
   * @param scenarioData 要导入的场景数据（包含 npcs 和 scenarios 的对象）
   * @returns 导入结果的响应
   */
  public async importScenarios(
    scenarioData: ScenarioExportData,
  ): Promise<ImportResponse> {
    try {
      // API 调用
      const rawResponse = await this.apiPost<ImportResponse>(
        "/scenarios/import",
        scenarioData,
      );
      // 将后端的 snake_case 响应转换为 camelCase
      return transformImportResponse(rawResponse);
    } catch (error) {
      console.error("场景导入失败:", error);

      if (error instanceof Error) {
        throw new Error(`场景导入失败: ${error.message}`);
      } else {
        throw new Error("场景导入失败");
      }
    }
  }

  /**
   * 创建场景
   * @param scenarioData 要创建的场景数据
   * @returns 已创建的场景信息
   */
  public async createScenario(
    scenarioData: Partial<ScenarioInfo>,
  ): Promise<{ scenarioId: string; scenario: ScenarioInfo }> {
    try {
      // API 调用
      const response = await this.apiPost<{
        message: string;
        scenarioId: string;
        scenario: ScenarioInfo;
      }>("/scenarios", scenarioData);

      return {
        scenarioId: response.scenarioId,
        scenario: response.scenario,
      };
    } catch (error) {
      console.error("场景创建失败:", error);

      if (error instanceof Error) {
        throw new Error(`场景创建失败: ${error.message}`);
      } else {
        throw new Error("场景创建失败");
      }
    }
  }

  /**
   * 基于行业资料生成陪练场景草稿（不入库，前端预览编辑后由 createScenario 入库）。
   * 对应后端 POST /scenarios/generate。
   */
  public async generateScenario(params: {
    material: string;
    industry?: string;
    role?: string;
    trainingGoals?: string;
    difficulty?: string;
    category?: string;
  }): Promise<{ success: boolean; draft: Record<string, unknown> }> {
    try {
      const response = await this.apiPost<{
        success: boolean;
        draft: Record<string, unknown>;
      }>("/scenarios/generate", params);
      return response;
    } catch (error) {
      console.error("场景生成失败:", error);
      if (error instanceof Error) {
        throw new Error(`场景生成失败: ${error.message}`);
      } else {
        throw new Error("场景生成失败");
      }
    }
  }

  /**
   * 更新场景
   * @param scenarioId 待更新的场景 ID
   * @param scenarioData 要更新的场景数据
   * @returns 已更新的场景信息
   */
  public async updateScenario(
    scenarioId: string,
    scenarioData: Partial<ScenarioInfo>,
  ): Promise<{ scenario: ScenarioInfo }> {
    try {
      // API 调用
      const response = await this.apiPut<{
        message: string;
        scenario: ScenarioInfo;
      }>(`/scenarios/${scenarioId}`, scenarioData);

      return {
        scenario: response.scenario,
      };
    } catch (error) {
      console.error(`场景更新失败 (${scenarioId}):`, error);

      if (error instanceof Error) {
        throw new Error(`场景更新失败: ${error.message}`);
      } else {
        throw new Error("场景更新失败");
      }
    }
  }

  /**
   * 删除场景
   * @param scenarioId 要删除的场景 ID
   * @returns 删除结果
   */
  public async deleteScenario(
    scenarioId: string,
  ): Promise<{ message: string; scenarioId: string }> {
    try {
      // API 调用
      return await this.apiDelete<{ message: string; scenarioId: string }>(
        `/scenarios/${scenarioId}`,
      );
    } catch (error) {
      console.error(`场景删除失败 (${scenarioId}):`, error);

      if (error instanceof Error) {
        throw new Error(`场景删除失败: ${error.message}`);
      } else {
        throw new Error("场景删除失败");
      }
    }
  }

  /**
   * 更新场景的共享设置
   * @param scenarioId 目标场景 ID
   * @param visibility 公开范围设置
   * @param sharedWithUsers 共享对象的用户 ID 列表
   * @returns 更新结果
   */
  public async updateScenarioSharing(
    scenarioId: string,
    visibility: "public" | "private" | "shared",
    sharedWithUsers?: string[],
  ): Promise<{
    message: string;
    visibility: string;
    sharedWithUsers: string[];
  }> {
    try {
      // 创建请求数据
      const requestData: {
        visibility: "public" | "private" | "shared";
        sharedWithUsers?: string[];
      } = { visibility };

      // 共享设置时添加共享用户列表
      if (
        visibility === "shared" &&
        sharedWithUsers &&
        sharedWithUsers.length > 0
      ) {
        requestData.sharedWithUsers = sharedWithUsers;
      }

      // API 调用
      return await this.apiPost<{
        message: string;
        visibility: "public" | "private" | "shared";
        sharedWithUsers: string[];
      }>(`/scenarios/${scenarioId}/share`, requestData);
    } catch (error) {
      console.error(
        `更新场景共享设置失败 (${scenarioId}):`,
        error,
      );

      if (error instanceof Error) {
        throw new Error(
          `更新场景共享设置失败: ${error.message}`,
        );
      } else {
        throw new Error("更新场景共享设置失败");
      }
    }
  }

  /**
   * 获取可用的 Guardrails 列表
   * @returns Guardrails 列表
   */
  public async getGuardrails(): Promise<
    Array<{
      arn: string;
      id: string;
      name: string;
      description: string;
    }>
  > {
    try {
      // API 调用
      const response = await this.apiGet<{
        guardrails: Array<{
          arn: string;
          id: string;
          name: string;
          description: string;
        }>;
      }>("/guardrails");

      return response.guardrails;
    } catch (error) {
      console.error("获取 Guardrails 列表失败:", error);

      if (error instanceof Error) {
        throw new Error(`获取 Guardrails 列表失败: ${error.message}`);
      } else {
        throw new Error("获取 Guardrails 列表失败");
      }
    }
  }

  /**
   * 获取会话反馈
   *
   * 获取已保存的反馈分析数据。
   * 获取会话结果页面使用的反馈数据。
   *
   * @param sessionId 会话 ID
   * @returns 反馈分析结果
   * @throws Error - API 调用失败或未找到反馈时
   */
  public async getSessionFeedback(sessionId: string): Promise<{
    feedback: FeedbackAnalysisResult;
    createdAt: string;
    finalMetrics: Metrics;
    messageCount: number;
    goalResults?: {
      goalStatuses: GoalStatus[];
      scenarioGoals: Goal[];
      goalScore: number;
    };
  }> {
    try {
      // API 调用
      const response = await this.apiGet<{
        success: boolean;
        sessionId: string;
        feedback: FeedbackAnalysisResult;
        createdAt: string;
        finalMetrics: Metrics;
        messageCount: number;
        goalResults?: {
          goalStatuses: GoalStatus[];
          scenarioGoals: Goal[];
          goalScore: number;
        };
      }>(`/sessions/${sessionId}/feedback`);

      if (response.success && response.feedback) {
        const result = {
          feedback: response.feedback,
          createdAt: response.createdAt,
          finalMetrics: response.finalMetrics,
          messageCount: response.messageCount,
          ...(response.goalResults
            ? { goalResults: response.goalResults }
            : {}),
        };

        return result;
      } else {
        throw new Error("无法正常获取反馈数据");
      }
    } catch (error) {
      console.error(
        `获取会话反馈失败 (${sessionId}):`,
        error,
      );

      if (error instanceof Error) {
        throw new Error(
          `获取会话反馈失败: ${error.message}`,
        );
      } else {
        throw new Error("获取会话反馈失败");
      }
    }
  }

  /**
   * 获取会话分析结果
   *
   * 一次性获取 ResultPage 使用的会话全部数据。
   * 同时支持普通会话与语音分析会话。
   *
   * @param sessionId 会话 ID
   * @returns 会话分析结果数据
   * @throws Error - API 调用失败或未找到会话时
   */
  public async getSessionCompleteData(
    sessionId: string,
  ): Promise<SessionCompleteDataResponse> {
    try {
      // API 调用（支持语音分析会话）
      const response = await this.apiGet<SessionCompleteDataResponse>(
        `/sessions/${sessionId}/analysis-results`,
      );

      if (response.success) {
        // 将后端的 snake_case 响应转换为 camelCase
        return {
          ...response,
          complianceViolations: Array.isArray(response.complianceViolations)
            ? response.complianceViolations.map((v) =>
              typeof (v as unknown as Record<string, unknown>).rule_id === "string"
                ? transformComplianceViolation(v as never)
                : v,
            )
            : [],
          videoAnalysis: transformVideoAnalysisResult(response.videoAnalysis),
        };
      } else {
        throw new Error("无法正常获取会话分析结果");
      }
    } catch (error) {
      console.error(
        `获取会话分析结果失败 (${sessionId}):`,
        error,
      );

      if (error instanceof Error) {
        throw new Error(
          `获取会话分析结果失败: ${error.message}`,
        );
      } else {
        throw new Error("获取会话分析结果失败");
      }
    }
  }

  /**
   * 启动分片上传，并获取各分片的签名 URL
   *
   * 会话录制的视频文件，即使在长时间会话（超过 20 分钟等）中
   * 也不会达到 S3 的大小限制，因此无论文件大小如何，均采用分片方式
   * 上传。
   *
   * @param sessionId 会话 ID
   * @param contentType 视频的内容类型（video/mp4）
   * @param partCount 分割的分片数
   * @param fileName 文件名（可选）
   * @returns 分片上传 ID、视频键、各分片的签名 URL
   */
  public async createMultipartUpload(
    sessionId: string,
    contentType: string,
    partCount: number,
    fileName?: string,
  ): Promise<{
    uploadId: string;
    videoKey: string;
    partUrls: Array<{ partNumber: number; url: string }>;
    expiresIn: number;
  }> {
    try {
      return await this.apiPost<
        {
          uploadId: string;
          videoKey: string;
          partUrls: Array<{ partNumber: number; url: string }>;
          expiresIn: number;
        },
        {
          sessionId: string;
          contentType: string;
          partCount: number;
          fileName?: string;
        }
      >("/videos/multipart/create", {
        sessionId,
        contentType,
        partCount,
        ...(fileName !== undefined ? { fileName } : {}),
      });
    } catch (error) {
      console.error("分片上传启动失败:", error);

      if (error instanceof Error) {
        throw new Error(
          `分片上传启动失败: ${error.message}`,
        );
      } else {
        throw new Error("分片上传启动失败");
      }
    }
  }

  /**
   * 完成分片上传
   *
   * 所有分片上传完成后，指示 S3 合并各分片。
   *
   * @param videoKey 视频键
   * @param uploadId 分片上传 ID
   * @param parts 各分片的信息（分片编号与 ETag）
   * @returns 视频键与上传完成对象的 URL
   */
  public async completeMultipartUpload(
    videoKey: string,
    uploadId: string,
    parts: Array<{ partNumber: number; eTag: string }>,
  ): Promise<{ videoKey: string; location: string }> {
    try {
      return await this.apiPost<
        { videoKey: string; location: string },
        {
          videoKey: string;
          uploadId: string;
          parts: Array<{ partNumber: number; eTag: string }>;
        }
      >("/videos/multipart/complete", {
        videoKey,
        uploadId,
        parts,
      });
    } catch (error) {
      console.error("分片上传完成失败:", error);

      if (error instanceof Error) {
        throw new Error(
          `分片上传完成失败: ${error.message}`,
        );
      } else {
        throw new Error("分片上传完成失败");
      }
    }
  }

  /**
   * 中断分片上传
   *
   * 上传失败时调用，丢弃已上传的分片。
   *
   * @param videoKey 视频键
   * @param uploadId 分片上传 ID
   * @returns 中断成功标志
   */
  public async abortMultipartUpload(
    videoKey: string,
    uploadId: string,
  ): Promise<{ aborted: boolean }> {
    try {
      return await this.apiPost<
        { aborted: boolean },
        { videoKey: string; uploadId: string }
      >("/videos/multipart/abort", {
        videoKey,
        uploadId,
      });
    } catch (error) {
      // 中断失败不致命，因此仅输出警告日志并吞掉异常
      console.warn("分段上传中断失败:", error);
      return { aborted: false };
    }
  }

  /**
   * 判断 HTTP 响应状态码的通用方法
   * @param error 错误对象
   * @param statusCode 要判断的 HTTP 状态码
   * @returns 为指定状态码时返回 true
   */
  private hasResponseStatus(error: unknown, statusCode: number): boolean {
    if (error && typeof error === "object" && "response" in error) {
      const response = (error as { response: unknown }).response;
      if (response && typeof response === "object" && "status" in response) {
        return (response as { status: number }).status === statusCode;
      }
    }
    return false;
  }

  /** 判断是否为 504 Gateway Timeout 错误 */
  private isGatewayTimeoutError(error: unknown): boolean {
    return this.hasResponseStatus(error, 504);
  }

  /** 判断是否为 404 Not Found 错误 */
  private is404Error(error: unknown): boolean {
    return this.hasResponseStatus(error, 404);
  }

  /** 判断是否为 409 Conflict 错误 */
  private is409Error(error: unknown): boolean {
    return this.hasResponseStatus(error, 409);
  }

  /**
   * Polly 语音合成 API 调用
   * @param requestBody 请求体
   * @returns 语音 URL
   */
  public async callPollyAPI(requestBody: {
    text: string;
    voiceId?: string;
    engine?: string;
    languageCode?: string;
    textType?: "text" | "ssml";
  }): Promise<{
    success: boolean;
    audioUrl?: string;
    expiresIn?: number;
    text?: string;
    voiceId?: string;
    engine?: string;
    fileName?: string;
    visemes?: Array<{ time: number; type: string; value: string }>;
    error?: string;
    message?: string;
  }> {
    try {
      const response = await this.apiPost<{
        success: boolean;
        audioUrl?: string;
        expiresIn?: number;
        text?: string;
        voiceId?: string;
        engine?: string;
        fileName?: string;
        visemes?: Array<{ time: number; type: string; value: string }>;
        error?: string;
        message?: string;
      }>("/polly/convert", requestBody);

      if (!response.success) {
        throw new Error(
          response.error || response.message || "Polly 语音合成失败",
        );
      }

      return response;
    } catch (error) {
      console.error("Polly API调用错误:", error);

      if (error instanceof Error) {
        throw new Error(`Polly 语音合成失败: ${error.message}`);
      } else {
        throw new Error("Polly 语音合成失败");
      }
    }
  }

  /**
   * 生成音频文件上传用的签名 URL
   * @param fileName 文件名
   * @param contentType 音频文件的格式
   * @param language 语言设置
   * @returns 签名 URL 与会话信息
   */
  public async generateAudioUploadUrl(
    fileName: string,
    contentType: string,
    language: string
  ): Promise<{
    success: boolean;
    uploadUrl: string;
    formData: Record<string, string>;
    audioKey: string;
    sessionId: string;
    language: string;
  }> {
    try {
      const requestBody = {
        fileName,
        contentType,
        language
      };

      const response = await this.apiPost<{
        success: boolean;
        uploadUrl: string;
        formData: Record<string, string>;
        audioKey: string;
        sessionId: string;
        language: string;
      }>('/audio-analysis/upload-url', requestBody);

      if (!response.success) {
        throw new Error('生成签名 URL 失败');
      }

      return response;
    } catch (error) {
      console.error('音频上传URL生成错误:', error);

      if (error instanceof Error) {
        throw new Error(`生成语音上传 URL 失败: ${error.message}`);
      } else {
        throw new Error('生成语音上传 URL 失败');
      }
    }
  }

  /**
   * 开始语音分析
   * @param sessionId 会话 ID
   * @param audioKey 音频文件的 S3 键
   * @param scenarioId 场景 ID
   * @param language 语言设置
   * @returns 分析开始结果
   */
  public async startAudioAnalysis(
    sessionId: string,
    audioKey: string,
    scenarioId: string,
    language: string
  ): Promise<{
    success: boolean;
    sessionId: string;
    executionArn?: string;
    status: string;
    message?: string;
  }> {
    try {
      const requestBody = {
        audioKey,
        scenarioId,
        language
      };

      const response = await this.apiPost<{
        success: boolean;
        sessionId: string;
        executionArn?: string;
        status: string;
        message?: string;
      }>(`/audio-analysis/${sessionId}/analyze`, requestBody);

      return response;
    } catch (error) {
      console.error('音频分析开始错误:', error);

      if (error instanceof Error) {
        throw new Error(`开始语音分析失败: ${error.message}`);
      } else {
        throw new Error('开始语音分析失败');
      }
    }
  }

  /**
   * 确认语音分析状态
   * @param sessionId 会话 ID
   * @returns 分析状态
   */
  public async getAudioAnalysisStatus(sessionId: string): Promise<{
    success: boolean;
    sessionId: string;
    status: string;
    currentStep?: string;
    hasResult: boolean;
    progress?: Record<string, unknown>;
  }> {
    try {
      const response = await this.apiGet<{
        success: boolean;
        sessionId: string;
        status: string;
        currentStep?: string;
        hasResult: boolean;
        progress?: Record<string, unknown>;
      }>(`/audio-analysis/${sessionId}/status`);

      return response;
    } catch (error) {
      console.error('分析状态确认错误:', error);

      if (error instanceof Error) {
        throw new Error(`确认分析状态失败: ${error.message}`);
      } else {
        throw new Error('确认分析状态失败');
      }
    }
  }

  /**
   * 获取语音分析结果
   * @param sessionId 会话 ID
   * @returns 分析结果
   */
  public async getAudioAnalysisResults(sessionId: string): Promise<{
    success: boolean;
    sessionId: string;
    audioAnalysis?: Record<string, unknown>;
    scenarioId?: string;
    language?: string;
    createdAt?: string;
  }> {
    try {
      const response = await this.apiGet<{
        success: boolean;
        sessionId: string;
        audioAnalysis?: Record<string, unknown>;
        scenarioId?: string;
        language?: string;
        createdAt?: string;
      }>(`/audio-analysis/${sessionId}/results`);

      return response;
    } catch (error) {
      console.error('音频分析结果获取错误:', error);

      if (error instanceof Error) {
        throw new Error(`获取语音分析结果失败: ${error.message}`);
      } else {
        throw new Error('获取语音分析结果失败');
      }
    }
  }

  /**
   * 开始会话分析（Step Functions 集成）
   * @param sessionId 会话 ID
   * @param language 语言设置
   * @returns 分析开始结果
   */
  public async startSessionAnalysis(
    sessionId: string,
    language: string = "zh",
    goalStatuses?: GoalStatus[]
  ): Promise<{
    success: boolean;
    message: string;
    sessionId: string;
    status: string;
    executionArn?: string;
  }> {
    try {
      const requestBody: Record<string, unknown> = { language };

      // 传递会话中的目标进度
      if (goalStatuses && goalStatuses.length > 0) {
        requestBody.goalStatuses = goalStatuses.map(status => serializeGoalStatus(status));
      }

      const response = await this.apiPost<{
        success: boolean;
        message: string;
        sessionId: string;
        status: string;
        executionArn?: string;
      }>(`/sessions/${sessionId}/analyze`, requestBody);

      return response;
    } catch (error) {
      console.error('会话分析开始错误:', error);

      if (error instanceof Error) {
        throw new Error(`开始会话分析失败: ${error.message}`);
      } else {
        throw new Error('开始会话分析失败');
      }
    }
  }

  /**
   * 获取会话分析状态（用于轮询）
   * @param sessionId 会话 ID
   * @returns 分析状态
   */
  public async getSessionAnalysisStatus(sessionId: string): Promise<{
    success: boolean;
    sessionId: string;
    status: 'not_started' | 'processing' | 'completed' | 'failed' | 'timeout';
    message?: string;
    updatedAt?: string;
    errorMessage?: string;
  }> {
    try {
      const response = await this.apiGet<{
        success: boolean;
        sessionId: string;
        status: 'not_started' | 'processing' | 'completed' | 'failed' | 'timeout';
        message?: string;
        updatedAt?: string;
        errorMessage?: string;
      }>(`/sessions/${sessionId}/analysis-status`);

      return response;
    } catch (error) {
      console.error('会话分析状态获取错误:', error);

      if (error instanceof Error) {
        throw new Error(`获取会话分析状态失败: ${error.message}`);
      } else {
        throw new Error('获取会话分析状态失败');
      }
    }
  }

  /** 重新生成失败的陪练复盘报告。 */
  public async retrySessionAnalysis(sessionId: string): Promise<{
    success: boolean;
    sessionId: string;
    status: "processing";
    message: string;
  }> {
    return this.apiPost(`/sessions/${sessionId}/analysis-retry`, {});
  }
}
