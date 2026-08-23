import { ReferenceCheckResult } from "../types/api";

/**
 * 参考资料核查的状态
 */
export interface ReferenceCheckState {
  data: ReferenceCheckResult | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string;
  issuesCount: number;
}

/**
 * 参考资料核查用的自定义 Hook
 * 用于显示从 Step Functions 获取的参考资料核查结果的 Hook
 * 
 * @param isVisible 组件是否处于显示状态
 * @param initialData 从 Step Functions 获取的参考资料核查结果
 * @returns 参考资料核查的状态
 */
export const useReferenceCheck = (
  isVisible = true,
  initialData: ReferenceCheckResult | null = null,
): ReferenceCheckState => {
  /**
   * 计算有问题的消息数量
   * 仅统计“有问题 (issue)”。
   * “不适用 (not_applicable)”（问候、一般进程等）不作为问题处理。
   */
  const issuesCount = initialData?.messages
    ? initialData.messages.filter((msg) => msg.evaluation === "issue").length
    : 0;

  return {
    data: isVisible ? initialData : null,
    isLoading: false,
    isAnalyzing: false,
    error: "",
    issuesCount,
  };
};
