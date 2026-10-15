import { describe, expect, test } from "bun:test";
import { constellationOf, constellationSentence } from "./constellation";
import { buildCorpus } from "./corpus";
import { renderPages } from "./pages";
import { type ProjectCard, parseProjectCard } from "./project-card";

const card = (project: string, layer: string, verified = "2026-10-08"): ProjectCard =>
  parseProjectCard({
    project,
    repository: `libre-ai/${project}`,
    exposure: "idea",
    maturity: "idea",
    summary: "Résumé court.",
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    freshness: { last_verified_on: verified },
    kind: "satellite",
    layer,
    dependencies: [],
  });

describe("constellationOf (S1.3)", () => {
  test("counts products, numbered layers in use and transverse products from the cards", () => {
    const result = constellationOf([
      card("a", "couche-1"),
      card("b", "couche-1"),
      card("c", "couche-3", "2026-10-12"),
      card("d", "transverse"),
    ]);
    expect(result).toEqual({
      products: 4,
      layers: 2,
      transverse: 1,
      verifiedOn: "2026-10-12",
    });
  });

  test("an empty corpus fails closed instead of printing zero", () => {
    expect(() => constellationOf([])).toThrow("constellation.no_cards");
  });
});

describe("constellationSentence", () => {
  test("states the counts and where they come from, with the date", () => {
    const text = constellationSentence({
      products: 15,
      layers: 4,
      transverse: 3,
      verifiedOn: "2026-10-12",
    });
    expect(text).toContain("15 produits");
    expect(text).toContain("4 couches");
    expect(text).toContain("fiches");
    expect(text).toContain("2026-10-12");
  });

  test("agrees in number and omits the transverse clause when there is none", () => {
    const text = constellationSentence({
      products: 1,
      layers: 1,
      transverse: 0,
      verifiedOn: "2026-10-08",
    });
    expect(text).toContain("1 produit ");
    expect(text).toContain("1 couche,");
    expect(text).not.toContain("transverse");
  });

  test("uses no state word", () => {
    const text = constellationSentence({
      products: 15,
      layers: 4,
      transverse: 3,
      verifiedOn: "2026-10-12",
    });
    for (const word of ["utilisable", "prêt", "disponible", "éprouvé", "maturité"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });
});

describe("home page constellation block", () => {
  test("is derived from the cards: adding a card changes the page", () => {
    const render = (cards: ProjectCard[]) => renderPages(buildCorpus(cards), cards).get("/") ?? "";
    expect(render([card("a", "couche-1")])).toContain("1 produit ");
    expect(render([card("a", "couche-1"), card("b", "couche-2")])).toContain("2 produits");
  });
});
