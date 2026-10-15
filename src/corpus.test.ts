import { describe, expect, test } from "bun:test";

import { buildCorpus, renderRobots, renderSitemap, SITE_ORIGIN } from "./corpus";
import { type ProjectCard, parseProjectCard } from "./project-card";

const card = (project: string, repository: string): ProjectCard =>
  parseProjectCard({
    project,
    repository,
    exposure: "idea",
    maturity: "idea",
    summary: "Résumé court.",
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    kind: "satellite",
    layer: "couche-2",
    dependencies: [],
    freshness: { last_verified_on: "2026-10-08" },
  });

const cards = [card("notebook", "libre-ai/notebook"), card("sketch", "libre-ai/sketch")];
const corpus = buildCorpus(cards);

// PRD §6 lists 8 fixed routes and one product template (/produits/:id): 9 route templates.
describe("buildCorpus (G1 : 8 routes fixes + 1 gabarit fiche = 9 gabarits)", () => {
  test("lists the nine fixed V1 routes of PRD §6 plus one route per card", () => {
    const fixed = corpus.pages.filter((page) => page.kind === "fixed").map((page) => page.path);
    expect(fixed).toEqual([
      "/",
      "/mission",
      "/methode",
      "/produits",
      "/fabrique",
      "/offres",
      "/preuves",
      "/gouvernance",
      "/corrections",
      "/contribuer",
      "/deployer",
      "/licences",
      "/signaler",
    ]);
    expect(corpus.pages).toHaveLength(13 + cards.length);
  });

  test("gives each card a product route keyed by its project name", () => {
    const products = corpus.pages
      .filter((page) => page.kind === "product")
      .map((page) => page.path);
    expect(products).toEqual(["/produits/notebook", "/produits/sketch"]);
  });

  test("never lists a route twice", () => {
    const paths = corpus.pages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("renderSitemap (FR-11 : sitemap égal au corpus)", () => {
  test("the set of sitemap URLs equals the set of corpus pages", () => {
    const urls = [...renderSitemap(corpus).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    );
    const expected = corpus.pages.map((page) => `${SITE_ORIGIN}${page.path}`);
    expect(new Set(urls)).toEqual(new Set(expected));
    expect(urls).toHaveLength(expected.length);
  });

  test("is well-formed XML with the sitemap namespace", () => {
    const xml = renderSitemap(corpus);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });
});

describe("renderRobots (FR-11)", () => {
  test("points crawlers to the sitemap generated from the same corpus", () => {
    expect(renderRobots()).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});
