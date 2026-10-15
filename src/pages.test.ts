import { describe, expect, test } from "bun:test";

import { buildCorpus, SITE_ORIGIN } from "./corpus";
import { renderPages } from "./pages";
import { type ProjectCard, parseProjectCard } from "./project-card";
import { validProjection } from "./test-fixtures";

const card = (project: string, exposure: string, extra: Record<string, unknown> = {}) =>
  parseProjectCard({
    project,
    repository: `libre-ai/${project}`,
    exposure,
    maturity: "idea",
    summary: "Résumé court.",
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    freshness: { last_verified_on: "2026-10-08" },
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

  test("no public page shows an exposure or maturity label (ADR 0003)", () => {
    for (const [path, html] of pages) {
      expect(html, path).not.toContain('class="label"');
      expect(html, path).not.toMatch(
        /Exposition :|Maturité :|Spécification publiée|Utilisable et vérifiable/,
      );
    }
  });

  test("every product page links to its source repository, where the state is read (ADR 0003)", () => {
    const html = pages.get("/produits/sketch") ?? "";
    expect(html).toContain(
      '<a href="https://github.com/libre-ai/sketch" rel="noopener noreferrer">Code source</a>',
    );
  });

  test("a usable-verifiable card links to its application with noopener noreferrer (FR-09)", () => {
    const html = pages.get("/produits/notebook") ?? "";
    expect(html).toContain('href="https://notebook.example.test/"');
    expect(html).toMatch(/rel="noopener noreferrer"/);
  });

  test("a card without an application URL shows no empty link and no state notice", () => {
    const withoutUrl = [card("nourl", "usable-verifiable", { maturity: "usable" })];
    const html = renderPages(buildCorpus(withoutUrl), withoutUrl).get("/produits/nourl") ?? "";
    expect(html).not.toContain('href=""');
    expect(html).not.toContain("Ouvrir le produit");
    expect(html).not.toContain("Adresse applicative non publiée");
    expect(html).toContain("Code source");
  });

  test("an idea card with an application URL links to it (ADR 0003)", () => {
    const withUrl = [card("sketch", "idea", { application_url: "https://sketch.example.test/" })];
    const html = renderPages(buildCorpus(withUrl), withUrl).get("/produits/sketch") ?? "";
    expect(html).toContain(
      'href="https://sketch.example.test/" rel="noopener noreferrer">Ouvrir le produit',
    );
  });

  test("a product page shows its limits as a non-empty list (FR-03)", () => {
    const html = pages.get("/produits/sketch") ?? "";
    expect(html).toContain("Limites");
    expect(html).toContain("Pas d&#39;engagement de date.");
  });

  test("a product page shows its citation with author, verification date and source (FR-12)", () => {
    const html = pages.get("/produits/sketch") ?? "";
    expect(html).toContain("Libre AI");
    expect(html).toContain('Vérifié le <span class="nowrap">2026-10-08</span>');
    expect(html).toContain(`${SITE_ORIGIN}/produits/sketch`);
  });

  test("the proofs page lists each gate with its counter and the command that reproduces it (FR-06)", () => {
    const proofs = [
      { gate: "G2 fiches lues", examined: 2, violations: 0, command: "bun src/build-site.ts" },
      { gate: "G9 textes examinés", examined: 10, violations: 0, command: "bun src/build-site.ts" },
    ];
    const html = renderPages(corpus, cards, proofs).get("/preuves") ?? "";
    expect(html).toContain(
      '<td data-label="Contrôle">G2 fiches lues</td><td data-label="Examinés">2</td><td data-label="Violations">0</td><td data-label="Commande"><code>bun src/build-site.ts</code></td>',
    );
    expect(html).toContain("G9 textes examinés");
    expect(html).not.toContain("Les compteurs de chaque contrôle sont affichés");
  });

  test("the proofs page says so when no gate result is supplied", () => {
    const html = renderPages(corpus, cards).get("/preuves") ?? "";
    expect(html).toContain("Aucun résultat de contrôle n'est fourni");
  });

  test("a verification date in a citation never breaks at its hyphens (1440 px defect)", () => {
    const html = pages.get("/produits/sketch") ?? "";
    expect(html).toContain('<span class="nowrap">2026-10-08</span>');
  });

  test("the governance link name never breaks at its hyphen (1440 px defect)", () => {
    const html = pages.get("/gouvernance") ?? "";
    expect(html).toContain('<span class="nowrap">project-governance</span>');
  });

  test("the home page carries the two calls to action validated by the brand platform", () => {
    const html = renderPages(corpus, cards, [], new Map(), validProjection.copy.fr).get("/") ?? "";
    expect(html).toContain('<a href="/produits">Prenez les clés.</a>');
    expect(html).toContain('<a href="/preuves">Voir les preuves.</a>');
    expect(html).not.toContain("Voir les produits");
  });

  test("every page advertises the Atom feed to machines", () => {
    for (const html of pages.values()) {
      expect(html).toContain('<link rel="alternate" type="application/atom+xml" href="/atom.xml">');
    }
  });

  test("escapes card text instead of injecting it", () => {
    const hostile = [card("tricky", "idea", { summary: "<img src=x onerror=alert(1)>" })];
    const html = renderPages(buildCorpus(hostile), hostile).get("/produits/tricky") ?? "";
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("brand grammar in the markup (ADR 0002)", () => {
  test("every page has the wordmark and the three section links in its header", () => {
    for (const html of pages.values()) {
      expect(html).toContain(
        '<header class="site-header"><a class="wordmark" href="/">Libre AI</a>',
      );
      expect(html).toContain('<a href="/produits">Produits</a>');
    }
  });

  test("the product list shows each product in a frame with its summary (ADR 0003)", () => {
    const html = pages.get("/produits") ?? "";
    expect(html).toContain(
      '<li class="frame"><a href="/produits/sketch">sketch</a> <span class="summary">Résumé court.</span></li>',
    );
  });
});
