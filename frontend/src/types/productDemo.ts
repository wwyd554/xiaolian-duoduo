import type { BusinessReview, CriterionId } from "./businessReview";

export interface ProductDemoExample {
  id: "before" | "after";
  label: string;
  description: string;
  messages: { id: string; role: "user" | "npc"; content: string }[];
  review: BusinessReview;
}

export interface ProductDemo {
  scenarioId: string;
  scenarioTitle: string;
  product: { name: string; label: string; facts: string[] };
  customer: { name: string; role: string; company: string; context: string };
  goal: string;
  opening?: string;
  focusCriterionId?: CriterionId;
  examples: ProductDemoExample[];
  generatedAt: string;
  provenance: { kind: "synthetic-model-evaluated"; notice: string };
}
