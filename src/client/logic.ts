/**
 * Pure logic of the client module (ADR 0005), kept apart from the DOM code so it is unit-tested.
 * The rule engine lives here too: the build imports it to draw the trial without script.
 */

export type Theme = "clair" | "sombre";

export const THEME_STORAGE_KEY = "libre-ia-theme";

/** A saved choice wins only if it is one of the two themes; otherwise the system decides. */
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  if (saved === "clair" || saved === "sombre") return saved;
  return prefersDark ? "sombre" : "clair";
}

/** Keyboard navigation of a horizontal tab list (WAI-ARIA tabs pattern), wrapping at the ends. */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function clampStep(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1);
}

/** What an agent's action does, field by field: where data goes, which model works, and so on. */
export type FactValue = string | boolean;
export type Facts = Readonly<Record<string, FactValue>>;

/** One field of the trial; its first value is the harmless default. */
export interface FactField {
  readonly field: string;
  readonly values: readonly FactValue[];
}

/** A rule stops an action when every fact it lists holds. */
export interface RuleCondition {
  readonly id: string;
  readonly when: Facts;
}

/** The facts an action has when it states nothing: the first value of each field. */
export function defaultFacts(fields: readonly FactField[]): Facts {
  const facts: Record<string, FactValue> = {};
  for (const { field, values } of fields) {
    const first = values[0];
    if (first !== undefined) facts[field] = first;
  }
  return facts;
}

/**
 * The rules an action trips, in rule order (ADR 0010 §4: a rule's result is never written by
 * hand). The same function runs at build time, for the page without script, and in the client
 * module. Facts the action does not state keep their default.
 */
export function trippedRules<R extends RuleCondition>(
  rules: readonly R[],
  facts: Facts,
  defaults: Facts,
): R[] {
  const state: Record<string, FactValue> = { ...defaults, ...facts };
  return rules.filter((rule) =>
    Object.entries(rule.when).every(([field, value]) => state[field] === value),
  );
}
