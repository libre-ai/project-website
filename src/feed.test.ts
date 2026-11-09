import { describe, expect, test } from "bun:test";

import { buildCorpus, SITE_ORIGIN } from "./corpus";
import { citationFor, renderAtom } from "./feed";
import { type ProjectCard, parseProjectCard } from "./project-card";

const card = (project: string, lastVerifiedOn: string): ProjectCard =>
  parseProjectCard({
    project,
    repository: `libre-ai/${project}`,
    exposure: "idea",
    maturity: "idea",
    summary: "Résumé court.",
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    kind: "satellite",
    layer: "couche-2",
    dependencies: [],
    freshness: { last_verified_on: lastVerifiedOn },
  });

const cards = [card("notebook", "2026-10-08"), card("sketch", "2026-09-30")];
const corpus = buildCorpus(cards);

describe("renderAtom (FR-11 : flux égal aux pages produit du corpus)", () => {
  test("has one entry per product page, with the same canonical URLs", () => {
    const xml = renderAtom(corpus, cards);
    const links = [...xml.matchAll(/<link rel="alternate" href="([^"]+)"/g)].map((m) => m[1]);
    const expected = corpus.pages
      .filter((page) => page.kind === "product")
      .map((page) => `${SITE_ORIGIN}${page.path}`);
    expect(new Set(links)).toEqual(new Set(expected));
    expect(links).toHaveLength(expected.length);
  });

  test("dates each entry by its verification date and the feed by the most recent one", () => {
    const xml = renderAtom(corpus, cards);
    expect(xml).toContain("<updated>2026-10-08T00:00:00Z</updated>");
    expect(xml).toContain("<updated>2026-09-30T00:00:00Z</updated>");
    const feedHeader = xml.split("<entry>")[0] ?? "";
    expect(feedHeader.match(/<updated>([^<]+)<\/updated>/)?.[1]).toBe("2026-10-08T00:00:00Z");
  });

  test("is an Atom document with the Atom namespace", () => {
    expect(renderAtom(corpus, cards)).toContain('xmlns="http://www.w3.org/2005/Atom"');
  });
});

describe("citationFor (FR-12 : auteur, date de revue, source)", () => {
  test("names the author, the verification date and the canonical source", () => {
    const text = citationFor(card("notebook", "2026-10-08"));
    expect(text).toContain("Libre AI");
    expect(text).toContain("2026-10-08");
    expect(text).toContain(`${SITE_ORIGIN}/produits/notebook`);
  });
});
