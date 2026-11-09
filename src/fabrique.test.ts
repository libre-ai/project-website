import { describe, expect, test } from "bun:test";

import { buildCorpus, renderSitemap } from "./corpus";
import { renderPages } from "./pages";
import { type ProjectCard, parseProjectCard } from "./project-card";

const card = (project: string, layer: string, kind = "satellite"): ProjectCard =>
  parseProjectCard({
    project,
    repository: `libre-ai/${project}`,
    exposure: "idea",
    maturity: "idea",
    summary: "Résumé court.",
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    freshness: { last_verified_on: "2026-10-08" },
    kind,
    layer,
    dependencies: [],
  });

// Out of order on purpose: the page owns the order of the layers.
const cards = [
  card("delta", "transverse", "authority"),
  card("alpha", "couche-3"),
  card("bravo", "couche-1", "product"),
];
const corpus = buildCorpus(cards);
const html = renderPages(corpus, cards).get("/fabrique") ?? "";

describe("/fabrique (S3.4, FR-15)", () => {
  test("is a fixed route of the corpus and of the sitemap", () => {
    expect(corpus.pages.some((page) => page.path === "/fabrique" && page.kind === "fixed")).toBe(
      true,
    );
    expect(renderSitemap(corpus)).toContain("/fabrique</loc>");
  });

  test("one row per card: layer, product link, type and repository link", () => {
    const rows = html.match(/<tr>/g) ?? [];
    // One header row plus one row per card.
    expect(rows).toHaveLength(1 + cards.length);
    expect(html).toContain('<a href="/produits/alpha">alpha</a>');
    expect(html).toContain('href="https://github.com/libre-ai/alpha"');
    expect(html).toContain('data-label="Type"');
  });

  test("rows follow the constellation order, transverse last", () => {
    const order = ["bravo", "alpha", "delta"].map((name) => html.indexOf(`/produits/${name}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("shows no state column and no filter (ADR 0003)", () => {
    expect(html).not.toContain("exposure");
    expect(html).not.toContain("maturity");
    expect(html).not.toContain("<select");
  });

  test("a hostile repository name is escaped", () => {
    const hostile = [{ ...card("alpha", "couche-1"), repository: 'x"><script>1</script>' }];
    const page = renderPages(buildCorpus(hostile), hostile).get("/fabrique") ?? "";
    expect(page).not.toContain("<script>");
  });
});
