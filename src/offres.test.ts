import { describe, expect, test } from "bun:test";

import { buildCorpus, renderSitemap } from "./corpus";
import { renderPages } from "./pages";
import { CAPABILITIES } from "./pages/offres";
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
const pages = renderPages(corpus, cards);
const html = pages.get("/offres") ?? "";

describe("/offres (S3.1, FR-15, D-open-2)", () => {
  test("is a fixed route of the corpus and of the sitemap", () => {
    expect(corpus.pages.some((page) => page.path === "/offres" && page.kind === "fixed")).toBe(
      true,
    );
    expect(renderSitemap(corpus)).toContain("/offres</loc>");
  });

  test("states exactly five capabilities, in the order of the decision", () => {
    expect(CAPABILITIES.map((entry) => entry.name)).toEqual([
      "Inspecter",
      "Reproduire",
      "Modifier",
      "Déployer",
      "Contribuer",
    ]);
    expect(html.match(/<li class="frame">/g)).toHaveLength(5);
  });

  test("each capability links to a page of the site that carries its proof", () => {
    const known = new Set(corpus.pages.map((page) => page.path));
    for (const entry of CAPABILITIES) {
      expect(known.has(entry.proof), `${entry.name} -> ${entry.proof}`).toBe(true);
      expect(html).toContain(`<a href="${entry.proof}">`);
    }
  });

  test("offers nothing for sale and promises nothing free", () => {
    for (const word of ["payant", "tarif", "prix", "abonnement", "€", "gratuit", "essai"]) {
      expect(html.toLowerCase()).not.toContain(word);
    }
  });

  test("collects nothing", () => {
    for (const tag of ["<form", "<input", "<button", "<script"]) expect(html).not.toContain(tag);
  });
});
