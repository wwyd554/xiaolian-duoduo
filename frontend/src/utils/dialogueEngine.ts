import type {
  Metrics,
  Message,
  Goal,
  GoalStatus,
  Scenario,
} from "../types/index";
import { dialogueConfig } from "../config/dialogueConfig";

// 评估指标的限制值与会话设置
const { METRICS_MIN, METRICS_MAX } = dialogueConfig;

// 更新评估指标的函数
export const updateMetrics = (
  currentMetrics: Metrics,
  change: Partial<Metrics>,
): Metrics => {
  const newMetrics: Metrics = {
    angerLevel: Math.max(
      METRICS_MIN,
      Math.min(
        METRICS_MAX,
        currentMetrics.angerLevel + (change.angerLevel || 0),
      ),
    ),
    trustLevel: Math.max(
      METRICS_MIN,
      Math.min(
        METRICS_MAX,
        currentMetrics.trustLevel + (change.trustLevel || 0),
      ),
    ),
    progressLevel: Math.max(
      METRICS_MIN,
      Math.min(
        METRICS_MAX,
        currentMetrics.progressLevel + (change.progressLevel || 0),
      ),
    ),
  };

  return newMetrics;
};

// 为消息添加指标变化信息的处理
export const addMetricsChangesToMessages = (messages: Message[]): Message[] => {
  let previousMetrics: Metrics | null = null;

  return messages.map((message) => {
    if (message.metrics && previousMetrics) {
      const updatedMetrics = {
        ...message.metrics,
        angerChange: message.metrics.angerLevel - previousMetrics.angerLevel,
        trustChange: message.metrics.trustLevel - previousMetrics.trustLevel,
        progressChange:
          message.metrics.progressLevel - previousMetrics.progressLevel,
      };
      previousMetrics = { ...message.metrics };
      return { ...message, metrics: updatedMetrics };
    } else if (message.metrics) {
      previousMetrics = { ...message.metrics };
    }
    return message;
  });
};

/**
 * 根据 NPC 与用户的消息数计算轮数的函数
 *
 * @param messageCount 当前消息总数
 * @returns 当前轮数（NPC 与用户的一来一回计为 1 轮）
 */
export function calculateCurrentTurns(messageCount: number): number {
  // 考虑 NPC 的初始消息，奇数时向上取整
  return Math.ceil(messageCount / 2);
}

/**
 * 判断会话结束条件的函数
 *
 * 满足以下任一条件时结束会话：
 * 1. 怒气计达到最大值时
 * 2. 所有目标均达成时
 * 3. 消息数达到场景的最大轮数或设置的上限时
 *
 * @param metrics 当前指标值
 * @param messageCount 当前消息数
 * @param goalStatuses 目标达成情况（可选）
 * @param goals 场景的目标定义（可选）
 * @param scenario 场景信息（可选）
 * @returns 应结束会话时返回 true
 */
export const shouldEndSession = (
  metrics: Metrics,
  messageCount: number,
  goalStatuses?: GoalStatus[],
  goals?: Goal[],
  scenario?: Scenario,
): boolean => {
  // 1. 怒气达到最大值时
  if (metrics.angerLevel >= METRICS_MAX) {
    return true;
  }

  // 2. 所有目标均达成时
  if (goalStatuses && goals && goals.length > 0) {
    const allGoalsAchieved = goals.every((goal) => {
      const status = goalStatuses.find((s) => s.goalId === goal.id);
      return status && status.achieved;
    });

    if (allGoalsAchieved) {
      return true;
    }
  }

  // 3. 消息数达到最大轮数时
  // 场景有指定时使用之，否则使用默认值
  const maxTurns = scenario?.maxTurns || dialogueConfig.MAX_MESSAGE_COUNT;
  const currentTurns = calculateCurrentTurns(messageCount);

  if (currentTurns > maxTurns) {
    return true;
  }

  return false;
};

/**
 * 生成会话结束原因的函数
 *
 * 判断会话结束的原因并返回相应的消息。
 * 按以下优先级判断结束原因：
 * 1. 怒气计达到最大值时
 * 2. 所有目标均达成时
 * 3. 消息数达到最大轮数时
 *
 * @param metrics 当前指标值
 * @param messageCount 当前消息数
 * @param goalStatuses 目标达成情况（可选）
 * @param goals 场景的目标定义（可选）
 * @param scenario 场景信息（可选）
 * @returns 会话结束原因的消息
 */
export const getSessionEndReason = (
  metrics: Metrics,
  messageCount: number,
  goalStatuses?: GoalStatus[],
  goals?: Goal[],
  scenario?: Scenario,
): string => {
  if (metrics.angerLevel >= METRICS_MAX) {
    return "客户非常不满，商谈中断了。";
  }

  // 所有目标均达成时
  if (goalStatuses && goals && goals.length > 0) {
    const allGoalsAchieved = goals.every((goal) => {
      const status = goalStatuses.find((s) => s.goalId === goal.id);
      return status && status.achieved;
    });

    if (allGoalsAchieved) {
      return "恭喜你！已达成所有商谈目标！";
    }
  }

  // 消息数达到最大轮数时
  const maxTurns = scenario?.maxTurns || dialogueConfig.MAX_MESSAGE_COUNT;
  const currentTurns = calculateCurrentTurns(messageCount);

  if (currentTurns >= maxTurns) {
    return "预定的商谈时间已结束。辛苦了。";
  }

  return "商谈已结束。";
};
