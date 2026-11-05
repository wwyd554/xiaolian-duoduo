import type { BusinessReview } from "./businessReview";
export type ReviewSource = "practice" | "chat" | "audio";
export interface ReviewMessage {
  id?: string;
  messageId?: string;
  role: "user" | "npc";
  content: string;
}
export interface ReviewItem {
  id: string;
  title: string;
  scenario_id: string;
  status: string;
  created_at: string;
  source: ReviewSource;
  analysis_status: string | null;
  scenario_title?: string | null;
  overall_score?: number | null;
  key_finding?: string | null;
}
export interface ImportedReviewDetail {
  title: string;
  source: ReviewSource;
  context: string;
  status: string;
  messages: ReviewMessage[];
  report: {
    businessReview?: BusinessReview;
    summary: string;
    stage: string;
    limitations: string;
    findings: { kind: string; evidence: number[]; analysis: string }[];
    replies: { text: string; when: string }[];
  } | null;
}

/** Local speech recognition output; speaker identities must be confirmed by the user. */
export interface RecordingTranscription {
  text: string;
  segments: { start: number; end: number; text: string }[];
  durationSeconds: number;
  language: string;
}
