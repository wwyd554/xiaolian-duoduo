import React from "react";
import { useReferenceCheck } from "../../hooks/useReferenceCheck";
import ReferenceCheckStatus from "./ReferenceCheckStatus";
import ReferenceCheckResults from "./ReferenceCheckResults";
import { ReferenceCheckResult } from "../../types/api";

interface ReferenceCheckProps {
  sessionId: string;
  language?: string;
  isVisible?: boolean;
  /** 经 Step Functions 获取的引用检查结果（已传入时则不调用 API） */
  initialData?: ReferenceCheckResult | null;
}

/**
 * 引用检查结果展示组件
 */
const ReferenceCheck: React.FC<ReferenceCheckProps> = ({
  sessionId: _sessionId,
  language: _language = "zh",
  isVisible = true,
  initialData = null,
}) => {
  // sessionId 和 language 保留供将来扩展使用（当前使用 initialData）
  void _sessionId;
  void _language;
  const { data, isLoading, isAnalyzing, error, issuesCount } =
    useReferenceCheck(isVisible, initialData);

  // 组件处于隐藏状态时不显示任何内容
  if (!isVisible) {
    return null;
  }

  // 加载、分析中、出错、无数据时显示状态
  if (isLoading || isAnalyzing || error || !data) {
    return (
      <ReferenceCheckStatus
        isLoading={isLoading}
        isAnalyzing={isAnalyzing}
        error={error}
        hasData={!!data}
      />
    );
  }

  // 有数据时显示结果
  return <ReferenceCheckResults data={data} issuesCount={issuesCount} />;
};

export default ReferenceCheck;
