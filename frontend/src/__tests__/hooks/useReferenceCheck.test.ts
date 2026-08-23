import { renderHook } from "@testing-library/react";
import { useReferenceCheck } from "../../hooks/useReferenceCheck";
import type { ReferenceCheckResult } from "../../types/api";

/**
 * useReferenceCheck 钩子的测试
 *
 * 在 3 类评估（appropriate / not_applicable / issue）中，
 * 仅「存在问题 (issue)」会被计入 issuesCount。
 */
describe("useReferenceCheck", () => {
  /**
   * 生成测试用资料检查结果的辅助函数
   */
  const createResult = (
    evaluations: ReferenceCheckResult["messages"][number]["evaluation"][],
  ): ReferenceCheckResult => ({
    messages: evaluations.map((evaluation, index) => ({
      message: `消息${index + 1}`,
      relatedDocument: "",
      reviewComment: "",
      evaluation,
    })),
    summary: {
      totalMessages: evaluations.length,
      checkedMessages: evaluations.length,
    },
  });

  test("initialData 为 null 时，issuesCount 为 0", () => {
    const { result } = renderHook(() => useReferenceCheck(true, null));

    expect(result.current.data).toBeNull();
    expect(result.current.issuesCount).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.error).toBe("");
  });

  test("仅 issue 的发言计入 issuesCount", () => {
    const data = createResult(["issue", "appropriate", "not_applicable"]);
    const { result } = renderHook(() => useReferenceCheck(true, data));

    expect(result.current.issuesCount).toBe(1);
  });

  test("not_applicable（不适用）不作为问题计数", () => {
    // 仅问候和一般推进等无需资料参考的发言场景
    const data = createResult(["not_applicable", "not_applicable"]);
    const { result } = renderHook(() => useReferenceCheck(true, data));

    expect(result.current.issuesCount).toBe(0);
  });

  test("仅 appropriate（适当）时，issuesCount 为 0", () => {
    const data = createResult(["appropriate", "appropriate"]);
    const { result } = renderHook(() => useReferenceCheck(true, data));

    expect(result.current.issuesCount).toBe(0);
  });

  test("存在多个 issue 时，按其数量计数", () => {
    const data = createResult([
      "issue",
      "issue",
      "appropriate",
      "not_applicable",
      "issue",
    ]);
    const { result } = renderHook(() => useReferenceCheck(true, data));

    expect(result.current.issuesCount).toBe(3);
  });

  test("isVisible 为 false 时，data 为 null 但仍计算 issuesCount", () => {
    const data = createResult(["issue", "appropriate"]);
    const { result } = renderHook(() => useReferenceCheck(false, data));

    expect(result.current.data).toBeNull();
    expect(result.current.issuesCount).toBe(1);
  });
});
