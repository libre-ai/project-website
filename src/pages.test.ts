import { describe, expect, test } from "bun:test";

import { buildCorpus, SITE_ORIGIN } from "./corpus";
import { renderPages } from "./pages";
import { type ProjectCard, parseProjectCard } from "./project-card";

const card = (project: string, exposure: string, extra: Record<string, unknown> = {}) =>
  parseProjectCard({
    project,
    repository: `libre-ai/${project}`,
    exposure,
    maturity: "idea",
    summary: "Résumé court.",
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    ...extra,
  });

const cards: readonly ProjectCard[] = [
  card("sketch", "idea"),
  card("drafted", "spec-published", { maturity: "specified" }),
  card("notebook", "usable-verifiable", {
    maturity: "usable",
    application_url: "https://notebook.example.test/",
  }),
];
const corpus = buildCorpus(cards);
const pages = renderPages(corpus, cards);

describe("renderPages (G1, FR-07, FR-09, FR-12)", () => {
  test("renders one HTML document per corpus page", () => {
    expect([...pages.keys()].sort()).toEqual(corpus.pages.map((page) => page.path).sort());
  });

  test("every page declares French, a title, one h1 and its canonical URL", () => {
    for (const [path, html] of pages) {
      expect(html).toContain('<html lang="fr">');
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
      expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${path}">`);
    }
  });

  test("no page ships a script element, so pages read without JavaScript (FR-07)", () => {
    for (const html of pages.values()) {
      expect(html).not.toMatch(/<script[\s>]/i);
    }
  });

  test("an idea card never links to an application (FR-02)", () => {
    const html = pages.get("/produits/sketch") ?? "";
    expect(html).not.toContain("Ouvrir le produit");
    expect(html).not.toContain('href="https://sketch');
    expect(html).toContain("Suivre la fiche");
  });

  test("a usable-verifiable card links to its application with noopener noreferrer (FR-09)", () => {
    const html = pages.get("/produits/notebook") ?? "";
    expect(html).toContain('href="https://notebook.example.test/"');
    expect(html).toMatch(/rel="noopener noreferrer"/);
  });

  test("a product page shows its limits as a non-empty list (FR-03)", () => {
    const html = pages.get("/produits/sketch") ?? "";
    expect(html).toContain("Limites");
    expect(html).toContain("Pas d&#39;engagement de date.");
  });

  test("escapes card text instead of injecting it", () => {
    const hostile = [card("tricky", "idea", { summary: "<img src=x onerror=alert(1)>" })];
    const html = renderPages(buildCorpus(hostile), hostile).get("/produits/tricky") ?? "";
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});
