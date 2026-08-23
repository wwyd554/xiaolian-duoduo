/**
 * AgentCore Runtime 服务
 * 
 * 从前端直接调用 AgentCore Runtime 的服务
 * 使用 JWT 认证（Cognito）直接发起 HTTPS 请求
 * 
 * 注意：使用 JWT 认证时，必须使用 HTTPS 直接请求而非 AWS SDK
 * https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-oauth.html
 */
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import type { Message, NPC, Goal, GoalStatus } from "../types/index";
import type { ComplianceCheck } from "../types/api";
import { transformComplianceCheck } from "../utils/apiTransformers";
import { mergeGoalStatus, serializeGoalStatus } from "../utils/goalUtils";

// 从环境变量获取 AgentCore Runtime 配置
const AGENTCORE_ENABLED = import.meta.env.VITE_AGENTCORE_ENABLED === 'true';
const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'us-west-2';

// AgentCore Runtime ARNs
// CDK 部署时：VITE_AGENTCORE_NPC_CONVERSATION_ARN / VITE_AGENTCORE_REALTIME_SCORING_ARN
// 本地开发时：VITE_NPC_CONVERSATION_RUNTIME_ARN / VITE_REALTIME_SCORING_RUNTIME_ARN
const NPC_CONVERSATION_RUNTIME_ARN = import.meta.env.VITE_AGENTCORE_NPC_CONVERSATION_ARN || import.meta.env.VITE_NPC_CONVERSATION_RUNTIME_ARN || '';
const REALTIME_SCORING_RUNTIME_ARN = import.meta.env.VITE_AGENTCORE_REALTIME_SCORING_ARN || import.meta.env.VITE_REALTIME_SCORING_RUNTIME_ARN || '';

// AgentCore Data Plane 端点
const AGENTCORE_ENDPOINT = `https://bedrock-agentcore.${AWS_REGION}.amazonaws.com`;

// Access Token 提前刷新阈值（秒）
// 由于 AgentCore 会拒绝“1 分钟内即将失效的令牌”，
// 因此在剩余时间低于该提前量（2 分钟）时刷新，以吸收长负载发送过程中的令牌失效
const TOKEN_REFRESH_THRESHOLD_SEC = 120;

/**
 * 当 AgentCore Runtime 返回 401（认证错误）时抛出的专用错误
 *
 * 由于令牌失效或即将失效（"Ineffectual token, will expire within the next minute"）是
 * 主要原因，调用方可检测该错误并强制刷新令牌，用于重试判断。
 */
class AgentCoreUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentCoreUnauthorizedError";
  }
}

/**
 * AgentCore Runtime 服务类
 * 
 * 从前端直接调用 AgentCore Runtime
 * 使用 JWT 认证（Cognito ID 令牌）
 */
export class AgentCoreService {
  private static instance: AgentCoreService;

  private constructor() { }

  /**
   * 获取单例实例
   */
  public static getInstance(): AgentCoreService {
    if (!AgentCoreService.instance) {
      AgentCoreService.instance = new AgentCoreService();
    }
    return AgentCoreService.instance;
  }

  /**
   * 获取 Cognito Access Token
   *
   * 注意：AgentCore Runtime 的 JWT 认证使用 Access Token
   * （不是 ID Token）
   *
   * AgentCore 会预防性地拒绝“1 分钟内即将失效的令牌”
   * （401 "Ineffectual token, will expire within the next minute"）。
   * 由于 Amplify 的 fetchAuthSession 在令牌完全失效前都返回缓存，
   * 当剩余时间低于阈值（TOKEN_REFRESH_THRESHOLD_SEC）时
   * 用 forceRefresh 提前刷新，防止因这一间隙产生 401。
   *
   * @param forceRefresh 为 true 时，无论剩余时间多少都强制刷新令牌
   *                     （用于 401 重试时）
   */
  private async getAccessToken(forceRefresh = false): Promise<string> {
    try {
      await getCurrentUser();
      let authSession = await fetchAuthSession(
        forceRefresh ? { forceRefresh: true } : undefined,
      );

      // 非强制刷新时，若接近失效则提前刷新
      if (!forceRefresh) {
        const expSec = authSession.tokens?.accessToken?.payload?.exp;
        if (typeof expSec === "number") {
          const remainingSec = expSec - Math.floor(Date.now() / 1000);
          if (remainingSec < TOKEN_REFRESH_THRESHOLD_SEC) {
            authSession = await fetchAuthSession({ forceRefresh: true });
          }
        }
      }

      if (!authSession.tokens?.accessToken) {
        throw new Error("无法获取 Access Token");
      }

      return authSession.tokens.accessToken.toString();
    } catch (error) {
      console.error("认证错误:", error);
      throw new Error("用户未登录");
    }
  }

  /**
   * 检查 AgentCore Runtime 是否可用
   */
  public isAvailable(): boolean {
    return AGENTCORE_ENABLED && !!NPC_CONVERSATION_RUNTIME_ARN && !!REALTIME_SCORING_RUNTIME_ARN;
  }

  /**
   * 直接调用 AgentCore Runtime（HTTPS）
   * 
   * 使用 JWT 认证时，使用 HTTPS 直接请求而非 AWS SDK
   * 超时：120 秒（规避 API Gateway 的 29 秒限制）
   *
   * 若返回 401（令牌失效或即将失效），则强制刷新令牌并仅重试一次。
   * 由于 AgentCore 拒绝剩余 1 分钟内的令牌，作为绕过提前刷新（getAccessToken）
   * 的保险。
   */
  private async invokeAgentCoreRuntime<T>(
    runtimeArn: string,
    sessionId: string,
    payload: Record<string, unknown>
  ): Promise<T> {
    // 第一次正常获取（必要时内部提前刷新）
    const accessToken = await this.getAccessToken();

    try {
      return await this.sendAgentCoreRequest<T>(
        runtimeArn,
        sessionId,
        payload,
        accessToken,
      );
    } catch (error) {
      // 仅在 401（认证错误）时，强制刷新令牌后重试一次
      if (error instanceof AgentCoreUnauthorizedError) {
        console.warn(
          "AgentCore Runtime 401（令牌可能即将失效）。将强制刷新令牌后重试。",
        );
        const refreshedToken = await this.getAccessToken(true);
        return await this.sendAgentCoreRequest<T>(
          runtimeArn,
          sessionId,
          payload,
          refreshedToken,
        );
      }
      throw error;
    }
  }

  /**
   * 向 AgentCore Runtime 发送实际的 HTTPS 请求
   *
   * 为从 invokeAgentCoreRuntime 的重试机制中替换令牌并复用
   * 拆分了单次请求的发送处理。
   * 收到 401 时抛出 AgentCoreUnauthorizedError，由调用方判断重试。
   */
  private async sendAgentCoreRequest<T>(
    runtimeArn: string,
    sessionId: string,
    payload: Record<string, unknown>,
    accessToken: string,
  ): Promise<T> {
    // 对 ARN 进行 URL 编码
    const encodedArn = encodeURIComponent(runtimeArn);
    // 端点格式：/runtimes/{encodedArn}/invocations
    // 注意：不需要 qualifier 参数（否则会导致端点找不到的错误）
    const url = `${AGENTCORE_ENDPOINT}/runtimes/${encodedArn}/invocations`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 秒超时

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AgentCore Runtime 错误: ${response.status}`, errorText);
        // 401 属于令牌失效类，抛出专用错误供调用方重试
        if (response.status === 401) {
          throw new AgentCoreUnauthorizedError(errorText);
        }
        throw new Error(`AgentCore Runtime 调用错误: ${response.status} - ${errorText}`);
      }

      // 处理流式响应
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // Server-Sent Events 格式的流式响应
        return await this.processStreamingResponse<T>(response);
      } else {
        // 普通 JSON 响应
        // AgentCore Runtime 的响应以 {"output": {...}} 形式包装
        const rawData = await response.json() as { output?: T } | T;

        // 解除 output 包装
        const data = (rawData && typeof rawData === 'object' && 'output' in rawData && rawData.output)
          ? rawData.output
          : rawData as T;
        return data;
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AgentCore Runtime 调用超时（120 秒）');
      }

      console.error('AgentCore Runtime 调用错误:', error);
      throw error;
    }
  }

  /**
   * 处理流式响应
   */
  private async processStreamingResponse<T>(response: Response): Promise<T> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应体');
    }

    const decoder = new TextDecoder();
    const chunks: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // 解析 Server-Sent Events 格式
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            chunks.push(line.slice(6));
          } else if (line.trim() && !line.startsWith(':')) {
            chunks.push(line);
          }
        }
      }

      // 拼接后解析为 JSON
      const fullContent = chunks.join('');

      try {
        const rawData = JSON.parse(fullContent) as { output?: T } | T;
        // 解除 output 包装
        const data = (rawData && typeof rawData === 'object' && 'output' in rawData && rawData.output)
          ? rawData.output
          : rawData as T;
        return data;
      } catch {
        // JSON 解析失败时，作为消息返回
        return { message: fullContent } as T;
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 调用 NPC 对话智能体（直接调用）
   * 
   * 注意：对话历史由 AgentCore Memory 管理，因此不需要 previousMessages。
   * Session Manager 会自动恢复并持久化每个会话的对话历史。
   */
  public async chatWithNPC(
    message: string,
    npc: NPC,
    _previousMessages: Message[], // 由 AgentCore Memory 管理因此未使用（为兼容保留）
    sessionId?: string,
    messageId?: string,
    emotionParams?: {
      angerLevel?: number;
      trustLevel?: number;
      progressLevel?: number;
    },
    scenarioId?: string,
    language?: string,
    presentedSlides?: Array<{ pageNumber: number; imageKey: string }>,
  ): Promise<{ response: string; sessionId: string; messageId: string }> {
    if (!this.isAvailable()) {
      throw new Error('AgentCore Runtime 不可用');
    }

    const currentSessionId = sessionId || crypto.randomUUID();
    const currentMessageId = messageId || crypto.randomUUID();

    // 获取用户 ID（用于 AgentCore Memory 中的数据隔离）
    let userId: string;
    try {
      const currentUser = await getCurrentUser();
      userId = currentUser.userId;
    } catch (error) {
      console.error('用户ID获取错误:', error);
      throw new Error('用户未认证');
    }

    // 对话历史由 AgentCore Memory 管理，因此不发送 previousMessages
    const payload = {
      action: 'conversation',
      message,
      userId: userId, // 添加用户 ID（用作 AgentCore Memory 的 actorId）
      npcInfo: {
        name: npc.name,
        role: npc.role,
        company: npc.company,
        personality: npc.personality,
        description: npc.description,
      },
      sessionId: currentSessionId,
      messageId: currentMessageId,
      ...(scenarioId ? { scenarioId } : {}),
      ...(emotionParams ? {
        emotionParams: {
          angerLevel: emotionParams.angerLevel || 1,
          trustLevel: emotionParams.trustLevel || 1,
          progressLevel: emotionParams.progressLevel || 1,
        },
      } : {}),
      ...(language ? { language } : {}),
      ...(presentedSlides && presentedSlides.length > 0 ? { presentedSlides } : {}),
    };

    try {
      const result = await this.invokeAgentCoreRuntime<{
        message?: string;
        response?: string;
        sessionId?: string;
        messageId?: string;
        error?: string;
      }>(NPC_CONVERSATION_RUNTIME_ARN, currentSessionId, payload);

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        response: result.message || result.response || '',
        sessionId: result.sessionId || currentSessionId,
        messageId: result.messageId || currentMessageId,
      };
    } catch (error) {
      console.error("与NPC对话智能体调用错误:", error);
      return {
        response: "抱歉，生成回复时发生错误。请稍后再试一次。",
        sessionId: currentSessionId,
        messageId: currentMessageId,
      };
    }
  }

  /**
   * 调用实时评分智能体（直接调用）
   * 
   * 注意：对话历史由 AgentCore Memory 管理，因此不需要 previousMessages。
   * 智能体使用会话 ID 从 Memory 获取对话历史。
   */
  public async getRealtimeEvaluation(
    message: string,
    _previousMessages: Message[], // 由 AgentCore Memory 管理因此未使用（为兼容保留）
    sessionId?: string,
    goalStatuses?: GoalStatus[],
    goals?: Goal[],
    scenarioId?: string,
    language?: string,
    currentScores?: {
      angerLevel: number;
      trustLevel: number;
      progressLevel: number;
    },
    scenarioDescription?: string
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
    if (!this.isAvailable()) {
      throw new Error('AgentCore Runtime 不可用');
    }

    const currentSessionId = sessionId || crypto.randomUUID();

    // 获取用户 ID（用于 AgentCore Memory 中的数据隔离）
    let userId: string;
    try {
      const currentUser = await getCurrentUser();
      userId = currentUser.userId;
    } catch (error) {
      console.error('用户ID获取错误:', error);
      throw new Error('用户未认证');
    }

    // 对话历史由 AgentCore Memory 管理，因此不发送 previousMessages
    const payload = {
      action: 'scoring',
      message,
      userId: userId, // 添加用户 ID（用作 AgentCore Memory 的 actorId）
      // 包含当前分数（供智能体计算差值）
      currentScores: currentScores || {
        angerLevel: 1,
        trustLevel: 1,
        progressLevel: 1,
      },
      sessionId: currentSessionId,
      ...(goalStatuses ? {
        goalStatuses: goalStatuses.map(status => serializeGoalStatus(status))
      } : {}),
      ...(goals ? {
        goals: goals.map(goal => ({
          id: goal.id,
          description: goal.description || "",
          priority: typeof goal.priority === "number" ? goal.priority : 3,
          criteria: Array.isArray(goal.criteria) ? goal.criteria : [],
          hints: Array.isArray(goal.hints) ? goal.hints : [],
          isRequired: Boolean(goal.isRequired)
        }))
      } : {}),
      ...(scenarioId ? { scenarioId } : {}),
      ...(language ? { language } : {}),
      ...(scenarioDescription ? { scenarioDescription } : {}),
    };

    try {
      // AgentCore Runtime 响应格式：
      // {
      //   success: boolean,
      //   scores: { angerLevel, trustLevel, progressLevel },
      //   analysis: string,
      //   goalUpdates: [{ goalId, achieved, reason }],
      //   sessionId: string,
      //   memoryEnabled: boolean
      // }
      const result = await this.invokeAgentCoreRuntime<{
        success?: boolean;
        scores?: {
          angerLevel: number;
          trustLevel: number;
          progressLevel: number;
        };
        analysis?: string;
        goalUpdates?: Array<{
          goalId: string;
          achieved: boolean;
          reason?: string;
        }>;
        compliance?: ComplianceCheck;
        npcEmotion?: string;
        npcEmotionIntensity?: number;
        gesture?: string;
        suggestions?: string[];
        sessionId?: string;
        memoryEnabled?: boolean;
        error?: string;
      }>(REALTIME_SCORING_RUNTIME_ARN, currentSessionId, payload);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success !== false) {
        // 将 goalUpdates 转换为 goalStatuses（AgentCore Runtime 格式：{ goalId, achieved, reason }）
        let convertedGoalStatuses: GoalStatus[] | undefined;
        if (result.goalUpdates && Array.isArray(result.goalUpdates)) {
          // 从 goalStatuses 引用当前 progress，用公共函数合并
          const currentStatusMap = new Map(
            (goalStatuses || []).map(s => [s.goalId, s])
          );
          convertedGoalStatuses = result.goalUpdates.map((update) => {
            const currentStatus = currentStatusMap.get(update.goalId);
            const updateStatus: GoalStatus = {
              goalId: update.goalId,
              progress: update.achieved ? 100 : 0,
              achieved: update.achieved,
              reason: update.reason || '',
            };
            if (currentStatus) {
              return mergeGoalStatus(currentStatus, updateStatus);
            }
            return updateStatus;
          });
        }

        return {
          scores: result.scores ? {
            angerLevel: result.scores.angerLevel || 1,
            trustLevel: result.scores.trustLevel || 1,
            progressLevel: result.scores.progressLevel || 1,
          } : {
            angerLevel: 1,
            trustLevel: 1,
            progressLevel: 1,
          },
          analysis: result.analysis || "",
          goalStatuses: convertedGoalStatuses,
          ...(result.compliance ? { compliance: transformComplianceCheck(result.compliance) } : {}),
          npcEmotion: result.npcEmotion || 'neutral',
          npcEmotionIntensity: result.npcEmotionIntensity ?? 0.5,
          gesture: result.gesture || 'none',
          suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
        };
      }

      return {
        scores: { angerLevel: 1, trustLevel: 1, progressLevel: 1 },
        analysis: "",
        compliance: undefined,
      };
    } catch (error) {
      console.error("实时评分智能体调用错误:", error);
      return {
        scores: { angerLevel: 1, trustLevel: 1, progressLevel: 1 },
        analysis: "",
        compliance: undefined,
      };
    }
  }
}
