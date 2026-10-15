/**
 * Project card boundary: exposure and maturity are read from the authority's
 * `project.v1` record, never typed into the site. The site renders what the
 * card states and refuses any card that claims an application it cannot prove.
 */
import { isoDay } from "./calendar";

// Exposure follows the I-15 proof scale carried by the card since ADR-0020.
const EXPOSURES = ["idea", "spec-published", "usable-verifiable", "proven"] as const;
const MATURITIES = ["idea", "specified", "usable", "proven"] as const;

// Exposures below this line must not link to an application (FR-02).

export type Exposure = (typeof EXPOSURES)[number];
export type Maturity = (typeof MATURITIES)[number];

// FR-14: layer and type are read from the card and shown with these labels; the values are the
// schema's own, an unknown one refuses the card.
export const LAYER_LABELS = {
  "couche-1": "Couche 1",
  "couche-2": "Couche 2",
  "couche-3": "Couche 3",
  "couche-4": "Couche 4",
  transverse: "Transverse",
} as const;
export const KIND_LABELS = {
  application: "Application",
  product: "Produit",
  authority: "Autorité",
  satellite: "Satellite",
  tool: "Outil",
} as const;
const LAYERS = Object.keys(LAYER_LABELS) as (keyof typeof LAYER_LABELS)[];
const KINDS = Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[];

export interface Dependency {
  readonly on: string;
  readonly why: string;
}

export interface ProjectCard {
  readonly layer: keyof typeof LAYER_LABELS;
  readonly kind: keyof typeof KIND_LABELS;
  // What the project relies on, as the card declares it (no pin, no state).
  readonly dependencies: readonly Dependency[];
  readonly project: string;
  readonly repository: string;
  readonly exposure: Exposure;
  readonly maturity: Maturity;
  readonly summary: string;
  readonly currentSituation: string;
  // Limites (FR-03) are carried by non_goals, which the schema already requires non-empty.
  readonly limits: readonly string[];
  readonly applicationUrl: string | null;
  // Date the card's evidence was last re-verified (freshness); the citation and the feed rely on it.
  readonly lastVerifiedOn: string;
}

export interface ProjectCardGateReport {
  readonly examined: number;
  readonly violations: readonly string[];
}

function record(value: unknown, error: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(error);
  return value as Record<string, unknown>;
}

function text(value: unknown, error: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(error);
  return value;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  error: string,
): T[number] {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(error);
  }
  return value as T[number];
}

// Fails closed on shape. Blank content is not a shape error: the gate reports it as a missing limit.
function limits(value: unknown, project: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`project_card.non_goals_invalid:${project}`);
  return value.map((entry) => {
    if (typeof entry !== "string") throw new Error(`project_card.non_goals_invalid:${project}`);
    return entry;
  });
}

function dependencies(value: unknown, project: string): readonly Dependency[] {
  const error = `project_card.dependencies_invalid:${project}`;
  if (!Array.isArray(value)) throw new Error(error);
  return value.map((entry) => {
    const item = record(entry, error);
    return { on: text(item.on, error), why: text(item.why, error) };
  });
}

export function parseProjectCard(value: unknown): ProjectCard {
  const input = record(value, "project_card.object_invalid");
  const project = text(input.project, "project_card.project_invalid");
  const applicationUrl = input.application_url;
  return {
    layer: oneOf(input.layer, LAYERS, `project_card.layer_invalid:${project}`),
    kind: oneOf(input.kind, KINDS, `project_card.kind_invalid:${project}`),
    dependencies: dependencies(input.dependencies, project),
    project,
    repository: text(input.repository, `project_card.repository_invalid:${project}`),
    exposure: oneOf(input.exposure, EXPOSURES, `project_card.exposure_invalid:${project}`),
    maturity: oneOf(input.maturity, MATURITIES, `project_card.maturity_invalid:${project}`),
    summary: text(input.summary, `project_card.summary_invalid:${project}`),
    currentSituation: text(
      input.current_situation,
      `project_card.current_situation_invalid:${project}`,
    ),
    limits: limits(input.non_goals, project),
    lastVerifiedOn: isoDay(
      record(input.freshness, `project_card.last_verified_on_invalid:${project}`).last_verified_on,
      `project_card.last_verified_on_invalid:${project}`,
    ),
    applicationUrl:
      applicationUrl === undefined
        ? null
        : text(applicationUrl, `project_card.url_invalid:${project}`),
  };
}

export function checkProjectCardGates(cards: readonly ProjectCard[]): ProjectCardGateReport {
  const violations: string[] = [];
  for (const card of cards) {
    if (card.limits.every((entry) => entry.trim() === "")) {
      violations.push(`fiche.limits_missing:${card.project}`);
    }
  }
  return { examined: cards.length, violations };
}
