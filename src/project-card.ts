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
const EXPOSURES_WITHOUT_APPLICATION: readonly Exposure[] = ["idea", "spec-published"];

export type Exposure = (typeof EXPOSURES)[number];
export type Maturity = (typeof MATURITIES)[number];

export interface ProjectCard {
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

export function parseProjectCard(value: unknown): ProjectCard {
  const input = record(value, "project_card.object_invalid");
  const project = text(input.project, "project_card.project_invalid");
  const applicationUrl = input.application_url;
  return {
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
    if (card.applicationUrl !== null && EXPOSURES_WITHOUT_APPLICATION.includes(card.exposure)) {
      violations.push(`fiche.application_url_forbidden:${card.project}`);
    }
    if (card.limits.every((entry) => entry.trim() === "")) {
      violations.push(`fiche.limits_missing:${card.project}`);
    }
  }
  return { examined: cards.length, violations };
}
