import { describe, expect, test } from "bun:test";

import { citationFor } from "./citation";
import { brickPath, SITE_ORIGIN } from "./origin";
import { parseProjectCard } from "./project-card";

const card = parseProjectCard({
  project: "sketch",
  repository: "libre-ai/sketch",
  exposure: "idea",
  maturity: "idea",
  summary: "Résumé court.",
  current_situation: "Aucun code n'existe encore à ce stade.",
  non_goals: ["Pas d'engagement de date."],
  freshness: { last_verified_on: "2026-10-08" },
  kind: "satellite",
  layer: "couche-2",
  dependencies: [],
});

describe("canonical origin and brick citation (ADR 0006 §1)", () => {
  test("the site is cited at its canonical origin", () => {
    expect(SITE_ORIGIN).toBe("https://libre-ia.fr");
    expect(brickPath("sketch")).toBe("/fabrique/briques/sketch/");
  });

  test("a brick citation names the author, the verification day and the brick's page", () => {
    expect(citationFor(card)).toBe(
      "Libre AI. « sketch ». Vérifié le 2026-10-08. https://libre-ia.fr/fabrique/briques/sketch/",
    );
  });

  test("a citation never points at a local or former address", () => {
    expect(citationFor(card)).not.toMatch(/localhost|\/produits\//);
  });
});
