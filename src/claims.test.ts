import { describe, expect, test } from "bun:test";
import { checkForbiddenClaims } from "./claims";
import forbiddenClaims from "./data/forbidden-claims.json";

describe("forbidden claims list (PRD §9, G9)", () => {
  test("is non-empty data and includes the four charter words", () => {
    expect(forbiddenClaims).toEqual(
      expect.arrayContaining([
        "gratuit",
        "sécurité totale",
        "aucune dépendance",
        "contrôle absolu",
      ]),
    );
  });

  test.each(forbiddenClaims)("a fixture containing %s fails the gate", (word) => {
    const report = checkForbiddenClaims([
      { id: "fixture", text: `Une phrase avec ${word} dedans.` },
    ]);
    expect(report.violations).toEqual([`claim.forbidden:fixture:${word}`]);
  });

  test("matches case-insensitively", () => {
    const report = checkForbiddenClaims([{ id: "page", text: "Votre outil est GRATUIT." }]);
    expect(report.violations).toEqual(["claim.forbidden:page:gratuit"]);
  });

  test("passes a clean text and counts it as examined", () => {
    const report = checkForbiddenClaims([
      { id: "clean", text: "Le produit est en état idée, sans URL applicative." },
    ]);
    expect(report).toEqual({ examined: 1, violations: [] });
  });

  test("counts every text examined, even when several contain violations", () => {
    const report = checkForbiddenClaims([
      { id: "a", text: "gratuit" },
      { id: "b", text: "rien à signaler" },
      { id: "c", text: "contrôle absolu" },
    ]);
    expect(report.examined).toBe(3);
    expect(report.violations).toEqual([
      "claim.forbidden:a:gratuit",
      "claim.forbidden:c:contrôle absolu",
    ]);
  });
});
