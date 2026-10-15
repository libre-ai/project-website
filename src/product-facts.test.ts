import { describe, expect, test } from "bun:test";

import { buildCorpus } from "./corpus";
import { renderPages } from "./pages";
import { parseProjectCard } from "./project-card";

const base = {
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
  dependencies: [{ on: "libre-ai/project-governance", why: "Doctrine de flotte." }],
};

const page = (extra: Record<string, unknown> = {}) => {
  const cards = [parseProjectCard({ ...base, ...extra })];
  return renderPages(buildCorpus(cards), cards).get("/produits/sketch") ?? "";
};

describe("product facts (O3, S2.1)", () => {
  test("a product page names its layer and its type", () => {
    const html = page();
    expect(html).toContain("<dt>Couche</dt><dd>Couche 2</dd>");
    expect(html).toContain("<dt>Type</dt><dd>Satellite</dd>");
  });

  test("the transverse layer and the application type have their own labels", () => {
    const html = page({ layer: "transverse", kind: "application" });
    expect(html).toContain("<dd>Transverse</dd>");
    expect(html).toContain("<dd>Application</dd>");
  });

  test("dependencies are listed with their reason", () => {
    const html = page();
    expect(html).toContain("libre-ai/project-governance");
    expect(html).toContain("Doctrine de flotte.");
  });

  test("a card without dependency omits the section instead of claiming none", () => {
    const html = page({ dependencies: [] });
    expect(html).not.toContain("Dépendances");
  });

  test("no state vocabulary of the card reaches the page (ADR 0003)", () => {
    const html = page({
      phases: [{ id: "x", title: "PHASE-MARK", note: "n", exit_criteria: [] }],
      promotion_criteria: [{ to: "usable", when: "PROMOTION-MARK" }],
      kill_predicates: ["KILL-MARK"],
    });
    for (const mark of ["PHASE-MARK", "PROMOTION-MARK", "KILL-MARK"]) {
      expect(html).not.toContain(mark);
    }
    expect(html).not.toContain("usable-verifiable");
  });

  test("an unknown layer or type refuses the card", () => {
    expect(() => parseProjectCard({ ...base, layer: "couche-9" })).toThrow(
      "project_card.layer_invalid:sketch",
    );
    expect(() => parseProjectCard({ ...base, kind: "service" })).toThrow(
      "project_card.kind_invalid:sketch",
    );
  });

  test("a card without a dependencies list is refused, never read as empty", () => {
    const { dependencies: _omitted, ...without } = base;
    expect(() => parseProjectCard(without)).toThrow("project_card.dependencies_invalid:sketch");
  });
});
