import { describe, expect, test } from "bun:test";

import exclusions from "./data/card-exclusions.json";
import { checkCardUniverse } from "./universe";

describe("checkCardUniverse (G2 : chaque produit du portefeuille a sa fiche)", () => {
  test("passes when every non-excluded repository has a card", () => {
    const report = checkCardUniverse({
      repositories: ["alpha", "beta", "docs"],
      cards: ["alpha", "beta"],
      exclusions: [{ repository: "docs", reason: "groupe project" }],
    });
    expect(report).toEqual({ universe: 2, covered: 2, violations: [] });
  });

  test("fails a product that has no card instead of skipping it", () => {
    const report = checkCardUniverse({
      repositories: ["alpha", "beta"],
      cards: ["alpha"],
      exclusions: [],
    });
    expect(report.violations).toEqual(["universe.card_missing:beta"]);
  });

  test("fails a card that belongs to no repository of the portfolio", () => {
    const report = checkCardUniverse({
      repositories: ["alpha"],
      cards: ["alpha", "ghost"],
      exclusions: [],
    });
    expect(report.violations).toEqual(["universe.card_unknown:ghost"]);
  });

  test("refuses an exclusion without a reason", () => {
    expect(() =>
      checkCardUniverse({
        repositories: ["alpha"],
        cards: [],
        exclusions: [{ repository: "alpha", reason: " " }],
      }),
    ).toThrow("universe.exclusion_reason_missing:alpha");
  });

  test("the committed exclusions name .github and project-website with a reason each", () => {
    expect(exclusions.map((entry) => entry.repository).sort()).toEqual([
      ".github",
      "project-website",
    ]);
    for (const entry of exclusions) expect(entry.reason.trim().length).toBeGreaterThan(10);
  });
});
