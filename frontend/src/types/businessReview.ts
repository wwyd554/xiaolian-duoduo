import type { ScenarioInfo } from "./api";
export type CriterionId = "S1" | "S2" | "S3" | "S4" | "S5";

export interface ReviewEvidence {
  messageId: string;
  speaker: "user" | "npc";
  quote: string;
}

export interface BusinessCriterion {
  id: CriterionId;
  label: string;
  weight: number;
  status: "assessed" | "not_applicable" | "insufficient_evidence" | "evaluation_error";
  score: 0 | 1 | 2 | null;
  reason: string;
  evidence: ReviewEvidence[];
  checkedMessageIds: string[];
  missingBehavior: string;
  nextPractice: string;
}

export interface BusinessReview {
  rubricId: string;
  rubricVersion: string;
  status: "completed" | "incomplete";
  totalScore: number | null;
  criteria: BusinessCriterion[];
  coaching: { keep: string; fix: string; nextPractice: string; focusCriterionId: CriterionId | null };
  riskChecks: {
    status: "not_checked" | "review_required";
    limitations: string;
    findings: { id: string; type: string; status: "pending_review"; evidence: ReviewEvidence[]; reason: string }[];
  };
  coverage: { assessed: number; applicable: number };
}

export interface PracticePlan {
  scenarioSnapshot: ScenarioInfo;
  scenarioId: string;
  sourceSessionId: string;
  criterionId: CriterionId;
  label: string;
  instruction: string;
  previousScore: number;
  rubricVersion: string;
}

export interface PracticeComparison {
  sourceSessionId: string;
  criterionId: CriterionId;
  previousScore: number | null;
  currentScore: number | null;
  delta: number | null;
  comparable: boolean;
  reason: string;
}
