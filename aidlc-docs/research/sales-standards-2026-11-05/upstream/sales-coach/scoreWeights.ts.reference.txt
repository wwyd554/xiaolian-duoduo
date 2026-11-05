import type { Call } from "@/types";
import { MICRO_SKILL_KEYS, scoreMicroSkills, type SalesMethodology } from "./methodology";
import { SCORECARD_KEYS, SCORECARD_LABELS, type ScorecardKey } from "./ai/review";

export const SCRIPT_METRIC_KEY = "scriptAdherence";
export const MAX_METRIC_WEIGHT = 10;

export interface WeightedMetric {
  key: string;
  label: string;
}

const WEIGHT_KEYS = new Set<string>([SCRIPT_METRIC_KEY, ...SCORECARD_KEYS, ...MICRO_SKILL_KEYS]);

export function metricsForMethod(method: SalesMethodology): WeightedMetric[] {
  const pillarKeys = new Set<string>(method.pillars.map((pillar) => pillar.key));
  const pillars = method.pillars.map((pillar) => ({ key: pillar.key, label: pillar.label }));
  const rest = SCORECARD_KEYS.filter((key) => !pillarKeys.has(key)).map((key) => ({
    key,
    label: SCORECARD_LABELS[key],
  }));
  const skills = method.microSkills.map((skill) => ({ key: skill.key, label: skill.label }));
  return [
    ...pillars,
    { key: SCRIPT_METRIC_KEY, label: "Script adherence" },
    ...rest,
    ...skills,
  ];
}

export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_METRIC_WEIGHT, Math.max(0, Math.round(value)));
}

export function sanitizeWeights(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!WEIGHT_KEYS.has(key)) continue;
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) continue;
    out[key] = clampWeight(numeric);
  }
  return out;
}

export function readStoredWeights(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    return sanitizeWeights(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Stored weights plus a default of 1 for every metric this method scores. */
export function weightsForMethod(stored: Record<string, number>, method: SalesMethodology): Record<string, number> {
  const out: Record<string, number> = { ...stored };
  for (const key of WEIGHT_KEYS) {
    if (out[key] == null) out[key] = 1;
  }
  for (const metric of metricsForMethod(method)) {
    if (out[metric.key] == null) out[metric.key] = 1;
  }
  return out;
}

export function mergeIncomingWeights(current: Record<string, number>, incoming: unknown): Record<string, number> {
  return { ...current, ...sanitizeWeights(incoming) };
}

export function weightsAreCustom(weights: Record<string, number>, method: SalesMethodology): boolean {
  return metricsForMethod(method).some((metric) => (weights[metric.key] ?? 1) !== 1);
}

export function formatWeightDirective(method: SalesMethodology, weights: Record<string, number>): string | null {
  if (!weightsAreCustom(weights, method)) return null;
  const lines = metricsForMethod(method).map((metric) => `- ${metric.label}: ${weights[metric.key] ?? 1}`);
  return [
    "Metric weights (set by an admin). Score every metric on its own rubric from 0 to 10. Do not raise or lower a metric's score because its weight is high or low.",
    "In the bottom line, top fixes, and coaching brief, give more attention to higher weights. A weight of 0 is left out of the call score.",
    ...lines,
  ].join("\n");
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, value));
}

function statusScore(status: string | undefined): number {
  if (status === "Pass") return 10;
  if (status === "Incomplete") return 5;
  return 0;
}

/** Numeric 0–10 scores for the metrics this method weights. */
export function collectMetricScores(call: Call, method: SalesMethodology): Record<string, number> {
  const ev = call.evaluation;
  if (!ev) return {};
  const scores: Record<string, number> = {
    [SCRIPT_METRIC_KEY]: clampScore(ev.sandlerBreakdown.scriptAdherence.score),
  };
  for (const metric of ev.scorecard || []) {
    if (typeof metric.score === "number" && Number.isFinite(metric.score)) {
      scores[metric.key] = clampScore(metric.score);
    }
  }
  for (const pillar of method.pillars) {
    if (scores[pillar.key] == null) {
      scores[pillar.key] = statusScore(ev.sandlerBreakdown[pillar.key]?.status);
    }
  }
  // Re-reading every transcript on a list page is what made the bank feel stuck.
  // Skills already stored on the scorecard are used as-is.
  if (method.microSkills.length && call.transcriptText.trim()) {
    for (const skill of scoreMicroSkills(call.transcriptText, method.microSkills, call.repName)) {
      if (scores[skill.key] == null) scores[skill.key] = clampScore(skill.score);
    }
  }
  return scores;
}

/** Weighted average on a 0–100 scale. Null when every weighted metric is missing or weight 0. */
export function weightedCallScore(
  scores: Record<string, number>,
  weights: Record<string, number>,
  method: SalesMethodology
): number | null {
  let weighted = 0;
  let total = 0;
  for (const metric of metricsForMethod(method)) {
    const weight = weights[metric.key] ?? 1;
    if (!(weight > 0)) continue;
    const score = scores[metric.key];
    if (score == null || !Number.isFinite(score)) continue;
    weighted += clampScore(score) * weight;
    total += weight;
  }
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((weighted / total) * 10)));
}

export function weightShare(weights: Record<string, number>, method: SalesMethodology, key: string): number {
  const metrics = metricsForMethod(method);
  const total = metrics.reduce((sum, metric) => sum + (weights[metric.key] ?? 1), 0);
  if (total <= 0) return 0;
  return Math.round(((weights[key] ?? 1) / total) * 100);
}
