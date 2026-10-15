import { describe, expect, test } from "bun:test";

import { buildCorpus } from "./corpus";
import { renderPages } from "./pages";
import { parseProjectCard } from "./project-card";

const card = (project: string, layer: string) =>
  parseProjectCard({
    project,
    repository: `libre-ai/${project}`,
    exposure: "idea",
    maturity: "idea",
    summary: `Résumé de ${project}.`,
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    freshness: { last_verified_on: "2026-10-08" },
    kind: "satellite",
    layer,
    dependencies: [],
  });

// Declared out of order on purpose: the page owns the order of the layers.
const cards = [
  card("delta", "transverse"),
  card("alpha", "couche-3"),
  card("bravo", "couche-1"),
  card("charlie", "couche-1"),
];
const html = renderPages(buildCorpus(cards), cards).get("/produits") ?? "";

describe("product list grouped by layer (O3, S2.2)", () => {
  test("layers appear in constellation order, transverse last", () => {
    const order = ["Couche 1", "Couche 3", "Transverse"].map((label) =>
      html.indexOf(`<h2>${label}</h2>`),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("a layer without product has no heading", () => {
    expect(html).not.toContain("<h2>Couche 2</h2>");
    expect(html).not.toContain("<h2>Couche 4</h2>");
  });

  test("each product is listed once, under its own layer", () => {
    for (const project of ["alpha", "bravo", "charlie", "delta"]) {
      expect(html.match(new RegExp(`href="/produits/${project}"`, "g"))).toHaveLength(1);
    }
    const first = html.slice(html.indexOf("<h2>Couche 1</h2>"), html.indexOf("<h2>Couche 3</h2>"));
    expect(first).toContain("/produits/bravo");
    expect(first).toContain("/produits/charlie");
    expect(first).not.toContain("/produits/alpha");
  });

  test("the list carries no state filter or label", () => {
    expect(html).not.toContain("exposure");
    expect(html).not.toContain("maturity");
    expect(html).not.toContain("<select");
  });
});
