import FORBIDDEN_CLAIMS from "./data/forbidden-claims.json";

/**
 * Content gate (PRD §9, G9): the charter's forbidden claims are data, not code.
 * A text containing one of them fails the build, and the report counts every
 * text examined so a clean result cannot come from an empty corpus.
 */

export interface ClaimText {
  readonly id: string;
  readonly text: string;
}

export interface ClaimGateReport {
  readonly examined: number;
  readonly violations: readonly string[];
}

// Case-insensitive, with composed Unicode forms so an accented word matches either way.
function normalize(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("fr");
}

export function checkForbiddenClaims(
  texts: readonly ClaimText[],
  forbidden: readonly string[] = FORBIDDEN_CLAIMS,
): ClaimGateReport {
  const violations: string[] = [];
  for (const { id, text } of texts) {
    const haystack = normalize(text);
    for (const claim of forbidden) {
      if (haystack.includes(normalize(claim))) violations.push(`claim.forbidden:${id}:${claim}`);
    }
  }
  return { examined: texts.length, violations };
}
