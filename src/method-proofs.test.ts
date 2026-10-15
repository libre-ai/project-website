import { describe, expect, test } from "bun:test";

import { buildCorpus } from "./corpus";
import type { PublicProof } from "./domain";
import { renderPages } from "./pages";
import { parseProjectCard } from "./project-card";

const cards = [
  parseProjectCard({
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
  }),
];
const corpus = buildCorpus(cards);

const proofs: PublicProof[] = [
  {
    claim: "CLAIM-A-91c",
    mechanism: "MECHANISM-A-91c",
    source: "https://github.com/libre-ai/project-governance",
    verifiedOn: "2026-09-09",
    limitation: "LIMIT-A-91c",
  },
  {
    claim: "CLAIM-B-91c",
    mechanism: "MECHANISM-B-91c",
    source: "https://github.com/libre-ai",
    verifiedOn: "2026-09-10",
    limitation: "LIMIT-B-91c",
  },
];

const method = (value?: readonly PublicProof[]) =>
  renderPages(corpus, cards, { brandProofs: value }).get("/methode") ?? "";

describe("method page affirmations (S1.2)", () => {
  test("each proof shows its claim, mechanism, limit, date and a link to its source", () => {
    const html = method(proofs);
    for (const proof of proofs) {
      expect(html).toContain(proof.claim);
      expect(html).toContain(proof.mechanism);
      expect(html).toContain(proof.limitation);
      expect(html).toContain(`<span class="nowrap">${proof.verifiedOn}</span>`);
      expect(html).toContain(`href="${proof.source}"`);
    }
  });

  test("proofs keep the projection's order", () => {
    const html = method(proofs);
    expect(html.indexOf("CLAIM-A-91c")).toBeLessThan(html.indexOf("CLAIM-B-91c"));
  });

  test("a value is escaped before it reaches the page", () => {
    const html = method([{ ...proofs[0], claim: '<img src="x">' } as PublicProof]);
    expect(html).not.toContain('<img src="x">');
    expect(html).toContain("&lt;img");
  });

  test("without proofs the section is absent: nothing is claimed by default", () => {
    const html = method();
    expect(html).not.toContain("Limite");
    expect(html).toContain("<h1>Méthode</h1>");
  });
});
