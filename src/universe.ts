/**
 * Card universe (G2): every repository of the portfolio is either covered by a
 * card or listed as an exclusion with a reason. A product with neither fails the
 * build, so a missing card can never be mistaken for a product that does not exist.
 */

export interface Exclusion {
  readonly repository: string;
  readonly reason: string;
}

export interface UniverseInput {
  readonly repositories: readonly string[];
  readonly cards: readonly string[];
  readonly exclusions: readonly Exclusion[];
}

export interface UniverseReport {
  readonly universe: number;
  readonly covered: number;
  readonly violations: readonly string[];
}

export function checkCardUniverse(input: UniverseInput): UniverseReport {
  for (const exclusion of input.exclusions) {
    if (exclusion.reason.trim() === "") {
      throw new Error(`universe.exclusion_reason_missing:${exclusion.repository}`);
    }
  }
  const excluded = new Set(input.exclusions.map((entry) => entry.repository));
  const cards = new Set(input.cards);
  const repositories = new Set(input.repositories);
  const violations: string[] = [];

  const universe = input.repositories.filter((repository) => !excluded.has(repository));
  for (const repository of universe) {
    if (!cards.has(repository)) violations.push(`universe.card_missing:${repository}`);
  }
  for (const card of input.cards) {
    if (!repositories.has(card)) violations.push(`universe.card_unknown:${card}`);
  }
  return {
    universe: universe.length,
    covered: universe.filter((repository) => cards.has(repository)).length,
    violations,
  };
}
