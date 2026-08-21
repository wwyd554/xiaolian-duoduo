import type { Message, Metrics, Session } from "../types/index";
import i18next from "i18next";

/**
 * 分析サービス - セッション分析とレポート生成を担当
 */
export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {
    // シングルトンパターン
    console.log("分析サービス初期化");
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
          label: "怒りメーター",
          data: angerData,
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          tension: 0.2,
        },
        {
          label: "信頼度",
          data: trustData,
          borderColor: "rgb(54, 162, 235)",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          tension: 0.2,
        },
        {
          label: "商談進捗度",
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

    // 怒りメーターが高い場合
    if (finalMetrics.angerLevel >= 7) {
      keyPoints.push(
        "NPCの怒りメーターが非常に高くなっています。顧客の懸念や反応をより注意深く観察しましょう。",
      );
    } else if (finalMetrics.angerLevel <= 2) {
      keyPoints.push(
        "NPCの怒りメーターを低く保つことに成功しています。良好な対話を続けています。",
      );
    }

    // 信頼度に関する分析
    if (finalMetrics.trustLevel >= 8) {
      keyPoints.push(
        "高い信頼関係を構築できています。この信頼を活かして次のステップへの提案を検討しましょう。",
      );
    } else if (finalMetrics.trustLevel <= 3) {
      keyPoints.push(
        "信頼構築に課題があります。顧客のニーズをより深く理解することから始めましょう。",
      );
    }

    // 進捗度に関する分析
    if (finalMetrics.progressLevel >= 7) {
      keyPoints.push(
        "商談の進捗状況は良好です。クロージングに向けて準備を進めましょう。",
      );
    } else if (finalMetrics.progressLevel <= 3) {
      keyPoints.push(
        "商談の進捗が遅れています。顧客が求める価値をより明確に提示することを検討しましょう。",
      );
    }

    // メッセージ数の分析
    const userMessageCount = messages.filter(
      (msg) => msg.sender === "user",
    ).length;
    if (userMessageCount > 15) {
      keyPoints.push(
        "会話が長くなりすぎています。より簡潔かつ的確な質問と提案を心がけましょう。",
      );
    } else if (userMessageCount < 4) {
      keyPoints.push(
        "もう少し対話を続けることで、顧客のニーズをより深く理解できる可能性があります。",
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
          label: "平均スコア",
          data: [7, 6, 6, 7, 6],
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        },
      ],
    };
  }
}
