/**
 * Resource boundary (FR-04): a publishable resource carries a human author, a
 * declared AI assistance, its nature (§9) and a real review date. A resource
 * missing any of them is refused at construction, never published with a gap.
 */
import { isoDay } from "./calendar";

// Nature follows the content charter (PRD §9): fact, analysis, opinion or guide.
const NATURES = ["fait", "analyse", "opinion", "guide"] as const;

export type ResourceNature = (typeof NATURES)[number];

export interface Resource {
  readonly title: string;
  readonly author: string;
  readonly aiAssistance: string;
  readonly nature: ResourceNature;
  readonly reviewDate: string;
}

export interface ResourceGateReport {
  readonly examined: number;
  readonly violations: readonly string[];
}

function record(value: unknown, error: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
}

// Fails closed: absent, non-string or blank values are refused.
function text(value: unknown, error: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(error);
  return value;
}

export function parseResource(value: unknown): Resource {
  const input = record(value, "resource.object_invalid");
  const title = text(input.title, "resource.title_invalid");
  const nature = text(input.nature, `resource.nature_invalid:${title}`);
  if (!(NATURES as readonly string[]).includes(nature)) {
    throw new Error(`resource.nature_invalid:${title}`);
  }
  return {
    title,
    author: text(input.author, `resource.author_invalid:${title}`),
    aiAssistance: text(input.ai_assistance, `resource.ai_assistance_invalid:${title}`),
    nature: nature as ResourceNature,
    reviewDate: isoDay(input.review_date, `resource.review_date_invalid:${title}`),
  };
}

// Parsing already refuses incomplete resources, so the gate only counts what it examined.
// An empty corpus reports examined: 0, so a missing source cannot pass as a clean one.
export function checkResourceGates(resources: readonly Resource[]): ResourceGateReport {
  return { examined: resources.length, violations: [] };
}
