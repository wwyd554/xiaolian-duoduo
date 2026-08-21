import type {
  Metrics,
  Message,
  Goal,
  GoalStatus,
  Scenario,
} from "../types/index";
import { dialogueConfig } from "../config/dialogueConfig";

// 評価指標の制限値とセッション設定
const { METRICS_MIN, METRICS_MAX } = dialogueConfig;

// 評価指標を更新する関数
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

// メッセージにメトリクス変化情報を追加する処理
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
 * NPCとユーザーのメッセージ数からターン数を計算する関数
 *
 * @param messageCount 現在のメッセージ総数
 * @returns 現在のターン数（NPCとユーザーのやり取り1往復を1ターンとしてカウント）
 */
export function calculateCurrentTurns(messageCount: number): number {
  // NPCの初期メッセージを考慮して、奇数の場合は切り上げる
  return Math.ceil(messageCount / 2);
}

/**
 * セッション終了条件を判定する関数
 *
 * 以下の条件のいずれかが満たされた場合にセッションを終了します：
 * 1. 怒りメーターが最大値に達した場合
 * 2. すべてのゴールが達成された場合
 * 3. メッセージ数がシナリオの最大ターン数または設定された上限に達した場合
 *
 * @param metrics 現在のメトリクス値
 * @param messageCount 現在のメッセージ数
 * @param goalStatuses ゴール達成状況（オプショナル）
 * @param goals シナリオのゴール定義（オプショナル）
 * @param scenario シナリオ情報（オプショナル）
 * @returns セッションを終了すべき場合はtrue
 */
export const shouldEndSession = (
  metrics: Metrics,
  messageCount: number,
  goalStatuses?: GoalStatus[],
  goals?: Goal[],
  scenario?: Scenario,
): boolean => {
  // 1. 怒りが最大値に達した場合
  if (metrics.angerLevel >= METRICS_MAX) {
    return true;
  }

  // 2. すべてのゴールが達成された場合
  if (goalStatuses && goals && goals.length > 0) {
    const allGoalsAchieved = goals.every((goal) => {
      const status = goalStatuses.find((s) => s.goalId === goal.id);
      return status && status.achieved;
    });

    if (allGoalsAchieved) {
      return true;
    }
  }

  // 3. メッセージ数が最大ターン数に達した場合
  // シナリオに指定があればそれを使用、なければデフォルト値を使用
  const maxTurns = scenario?.maxTurns || dialogueConfig.MAX_MESSAGE_COUNT;
  const currentTurns = calculateCurrentTurns(messageCount);

  if (currentTurns > maxTurns) {
    return true;
  }

  return false;
};

/**
 * セッション終了理由を生成する関数
 *
 * セッションが終了した理由を判断し、適切なメッセージを返します。
 * 終了理由は以下の優先順位で判断されます：
 * 1. 怒りメーターが最大値に達した場合
 * 2. すべてのゴールが達成された場合
 * 3. メッセージ数が最大ターン数に達した場合
 *
 * @param metrics 現在のメトリクス値
 * @param messageCount 現在のメッセージ数
 * @param goalStatuses ゴール達成状況（オプショナル）
 * @param goals シナリオのゴール定義（オプショナル）
 * @param scenario シナリオ情報（オプショナル）
 * @returns セッション終了理由のメッセージ
 */
export const getSessionEndReason = (
  metrics: Metrics,
  messageCount: number,
  goalStatuses?: GoalStatus[],
  goals?: Goal[],
  scenario?: Scenario,
): string => {
  if (metrics.angerLevel >= METRICS_MAX) {
    return "顧客が非常に不快になり、商談が中断されました。";
  }

  // すべてのゴールが達成された場合
  if (goalStatuses && goals && goals.length > 0) {
    const allGoalsAchieved = goals.every((goal) => {
      const status = goalStatuses.find((s) => s.goalId === goal.id);
      return status && status.achieved;
    });

    if (allGoalsAchieved) {
      return "おめでとうございます！すべての商談目標を達成しました！";
    }
  }

  // メッセージ数が最大ターン数に達した場合
  const maxTurns = scenario?.maxTurns || dialogueConfig.MAX_MESSAGE_COUNT;
  const currentTurns = calculateCurrentTurns(messageCount);

  if (currentTurns >= maxTurns) {
    return "予定していた商談時間が終了しました。お疲れ様でした。";
  }

  return "商談が終了しました。";
};
