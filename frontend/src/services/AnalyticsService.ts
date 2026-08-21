import type { Message, Metrics, Session } from "../types/index";
import i18next from "i18next";

/**
 * 分析サービス - セッション分析とレポート生成を担当
 */
export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {
    // シングルトンパターン
    console.log("分析服务初始化");
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * セッションスコアを計算
   *
   * @param metrics 最終メトリクス
   * @param messages メッセージ履歴
   */
  public calculateSessionScore(metrics: Metrics, messages: Message[]): number {
    const angerScore = Math.max(0, 10 - metrics.angerLevel) * 3; // 最大30点 (低いほど良い)
    const trustScore = metrics.trustLevel * 4; // 最大40点
    const progressScore = metrics.progressLevel * 3; // 最大30点

    // ボーナス/ペナルティ計算
    const messageCount = messages.filter((msg) => msg.sender === "user").length;
    let bonusPoints = 0;

    // 適切な長さの対話にボーナス
    if (messageCount >= 5 && messageCount <= 15) {
      bonusPoints += 5;
    } else if (messageCount > 15) {
      bonusPoints -= 5; // 冗長なやり取りにはペナルティ
    }

    // 最終スコア計算 (100点満点)
    let finalScore = angerScore + trustScore + progressScore + bonusPoints;
    finalScore = Math.min(100, Math.max(0, finalScore));

    return Math.round(finalScore);
  }

  /**
   * メトリクス変化のチャートデータを生成
   */
  public generateMetricsChartData(messages: Message[]) {
    // メトリクスを持つメッセージのみフィルタ
    const metricsMessages = messages.filter((msg) => msg.metrics);

    if (metricsMessages.length === 0) {
      return null;
    }

    // タイムスタンプラベルを生成
    const labels = metricsMessages.map((_message, index) =>
      i18next.t("results.round", { count: index + 1 }),
    );

    // データセット作成
    const angerData = metricsMessages.map(
      (msg) => msg.metrics?.angerLevel || 0,
    );
    const trustData = metricsMessages.map(
      (msg) => msg.metrics?.trustLevel || 0,
    );
    const progressData = metricsMessages.map(
      (msg) => msg.metrics?.progressLevel || 0,
    );

    return {
      labels,
      datasets: [
        {
          label: "怒气值",
          data: angerData,
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          tension: 0.2,
        },
        {
          label: "信任度",
          data: trustData,
          borderColor: "rgb(54, 162, 235)",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          tension: 0.2,
        },
        {
          label: "商谈进度",
          data: progressData,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          tension: 0.2,
        },
      ],
    };
  }

  /**
   * キーポイントの分析を生成
   */
  public generateKeyPoints(session: Session): string[] {
    const keyPoints: string[] = [];
    const messages = session.messages;
    const finalMetrics = session.finalMetrics;

    // 怒气值分析
    if (finalMetrics.angerLevel >= 7) {
      keyPoints.push(
        "NPC 的怒气值非常高。请更仔细地观察客户的顾虑与反应。",
      );
    } else if (finalMetrics.angerLevel <= 2) {
      keyPoints.push(
        "你成功保持了较低的怒气值，对话进展良好。",
      );
    }

    // 信任度分析
    if (finalMetrics.trustLevel >= 8) {
      keyPoints.push(
        "已建立较高的信任关系。可以借此推动下一步提案。",
      );
    } else if (finalMetrics.trustLevel <= 3) {
      keyPoints.push(
        "信任建立存在挑战。建议从更深入地理解客户需求开始。",
      );
    }

    // 进度分析
    if (finalMetrics.progressLevel >= 7) {
      keyPoints.push(
        "商谈进展良好。可以继续向成交推进。",
      );
    } else if (finalMetrics.progressLevel <= 3) {
      keyPoints.push(
        "商谈进展较慢。建议更清晰地呈现客户所需价值。",
      );
    }

    // 消息数分析
    const userMessageCount = messages.filter(
      (msg) => msg.sender === "user",
    ).length;
    if (userMessageCount > 15) {
      keyPoints.push(
        "对话偏长。建议尽量简洁、准确地提问和提案。",
      );
    } else if (userMessageCount < 4) {
      keyPoints.push(
        "再多聊几句，可能会更深入地理解客户需求。",
      );
    }

    return keyPoints;
  }

  /**
   * モックパフォーマンスデータを生成（デモ用）
   */
  public generateMockPerformanceData() {
    return {
      labels: [
        i18next.t("results.skillLabels.communication"),
        i18next.t("results.skillLabels.needsAnalysis"),
        i18next.t("results.skillLabels.proposalQuality"),
        i18next.t("results.skillLabels.flexibility"),
        i18next.t("results.skillLabels.trustBuilding"),
      ],
      datasets: [
        {
          label: i18next.t("results.currentScore"),
          data: [
            Math.floor(Math.random() * 4) + 6, // 6-9
            Math.floor(Math.random() * 3) + 5, // 5-7
            Math.floor(Math.random() * 5) + 5, // 5-9
            Math.floor(Math.random() * 4) + 6, // 6-9
            Math.floor(Math.random() * 3) + 7, // 7-9
          ],
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
        {
          label: "平均得分",
          data: [7, 6, 6, 7, 6],
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        },
      ],
    };
  }
}
