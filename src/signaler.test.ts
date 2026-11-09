import { describe, expect, test } from "bun:test";

import { buildCorpus, renderSitemap } from "./corpus";
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
const pages = renderPages(corpus, cards);
const html = pages.get("/signaler") ?? "";

describe("/signaler (S3.5, FR-15)", () => {
  test("is a fixed route of the corpus and of the sitemap", () => {
    expect(corpus.pages.some((page) => page.path === "/signaler" && page.kind === "fixed")).toBe(
      true,
    );
    expect(renderSitemap(corpus)).toContain("/signaler</loc>");
  });

  test("points to the public forge issues of this site, as an external link", () => {
    expect(html).toContain(
      '<a href="https://github.com/libre-ai/project-website/issues" rel="noopener noreferrer">',
    );
  });

  test("collects nothing: no form, no field, no script", () => {
    for (const tag of ["<form", "<input", "<textarea", "<select", "<button", "<script"]) {
      expect(html).not.toContain(tag);
    }
  });

  test("is reachable from every other page by the footer", () => {
    for (const [path, page] of pages) {
      if (path === "/signaler") continue;
      expect(page, path).toContain('<a href="/signaler">');
    }
  });

  test("the navigation words are separated by a space", () => {
    const nav = html.match(/<nav>[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav).not.toContain("</a><a");
  });

  test("no page's footer links to the page itself, except the journal required by FR-05", () => {
    for (const [path, page] of pages) {
      const footer = page.match(/<footer>[\s\S]*?<\/footer>/)?.[0] ?? "";
      if (path !== "/corrections") expect(footer, path).not.toContain(`<a href="${path}">`);
      expect(footer, path).toContain("<a ");
    }
    const own = pages.get("/corrections") ?? "";
    expect(own).toContain('<a href="/corrections">Journal des corrections</a>');
  });

  test("names the correction journal as where a handled report is recorded", () => {
    expect(html).toContain('<a href="/corrections">');
  });
});
