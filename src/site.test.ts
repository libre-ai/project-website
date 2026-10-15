import { describe, expect, test } from "bun:test";

import { AUTHOR_PLACEHOLDER, parsePresentation } from "./presentation";
import { buildSite } from "./site";
import { validProjection } from "./test-fixtures";

const assets = { tokens: ":root { --lai-color-ink: #110f0c; }\n", styles: "body { margin: 0; }\n" };

const cardText = (project: string, exposure: string, extra = "") =>
  [
    `schema_version: "1.0"`,
    `project: ${project}`,
    `repository: libre-ai/${project}`,
    `exposure: ${exposure}`,
    `maturity: idea`,
    `summary: "Résumé court."`,
    `current_situation: "Aucun code n'existe encore à ce stade."`,
    `kind: satellite`,
    `layer: couche-2`,
    `dependencies: []`,
    `non_goals:`,
    `  - "Pas d'engagement de date."`,
    `freshness:`,
    `  last_verified_on: "2026-10-08"`,
    extra,
    "",
  ].join("\n");

describe("buildSite assets (G7 : feuilles produites, aucune ressource locale manquante)", () => {
  test("produces the tokens and styles that every page links to", () => {
    const result = buildSite(
      [{ name: "sketch.project.v1.yaml", text: cardText("sketch", "idea") }],
      assets,
    );
    expect(result.files.get("assets/tokens.css")).toBe(assets.tokens);
    expect(result.files.get("assets/styles.css")).toBe(assets.styles);
  });

  test("every local stylesheet a page references exists in the output", () => {
    const result = buildSite(
      [{ name: "sketch.project.v1.yaml", text: cardText("sketch", "idea") }],
      assets,
    );
    for (const [path, html] of result.files) {
      if (!path.endsWith(".html")) continue;
      for (const match of html.matchAll(/<link rel="stylesheet" href="\/([^"]+)"/g)) {
        expect(result.files.has(match[1] ?? ""), `${path} -> ${match[1]}`).toBe(true);
      }
    }
  });
});

describe("buildSite (G1, G2, G3, G4, G9 : gates bloquants, compteurs imprimés)", () => {
  test("builds every corpus page and reports the counters of each gate", () => {
    const result = buildSite(
      [
        { name: "sketch.project.v1.yaml", text: cardText("sketch", "idea") },
        { name: "drafted.project.v1.yaml", text: cardText("drafted", "spec-published") },
      ],
      assets,
    );
    // Each route is a directory index, which the Caddyfile file_server serves directly.
    expect(result.files.has("index.html")).toBe(true);
    expect(result.files.has("produits/sketch/index.html")).toBe(true);
    expect(result.files.has("produits/drafted/index.html")).toBe(true);
    expect(result.files.has("sitemap.xml")).toBe(true);
    expect(result.files.has("robots.txt")).toBe(true);
    expect(result.files.has("atom.xml")).toBe(true);
    expect(result.files.has("produits/sketch/citation.txt")).toBe(true);
    expect(result.report).toEqual({
      cardsRead: 2,
      productPages: 2,
      fixedPages: 12,
      resourcesExamined: 0,
      presentationsDrafted: 0,
      presentationsReviewed: 0,
      textsExamined: result.report.textsExamined,
      claimViolations: 0,
      brandFieldsRendered: 0,
      brandProofsRendered: 0,
      licencesRendered: 0,
    });
    expect(result.report.textsExamined).toBeGreaterThan(0);
  });

  test("reports the seven brand fields when a projection copy is supplied", () => {
    const result = buildSite(
      [{ name: "sketch.project.v1.yaml", text: cardText("sketch", "idea") }],
      assets,
      [],
      [],
      validProjection.copy.fr,
    );
    expect(result.report.brandFieldsRendered).toBe(7);
    expect(result.files.get("index.html")).toContain("Possédez la fabrique.");
  });

  test("a reviewed presentation replaces the card text and counts as a resource (ADR 0003)", () => {
    const presentation = parsePresentation({
      project: "sketch",
      title: "Sketch",
      author: "Relecteur nommé",
      ai_assistance: "Brouillon assisté, relu.",
      nature: "analyse",
      review_date: "2026-10-14",
      reviewed: true,
      pitch: "Sketch prépare votre voyage.",
      capabilities: ["Décrire des contraintes."],
      audience: "Voyageurs.",
    });
    const result = buildSite(
      [{ name: "sketch.project.v1.yaml", text: cardText("sketch", "idea") }],
      assets,
      [presentation],
    );
    const html = result.files.get("produits/sketch/index.html") ?? "";
    expect(html).toContain("<h1>Sketch</h1>");
    expect(html).toContain("Sketch prépare votre voyage.");
    expect(html).not.toContain("Situation actuelle");
    expect(result.report.resourcesExamined).toBe(1);
    expect(result.report.presentationsReviewed).toBe(1);
  });

  test("a draft presentation is examined but not published: the card text stays (ADR 0003)", () => {
    const draft = parsePresentation({
      project: "sketch",
      title: "Sketch",
      author: AUTHOR_PLACEHOLDER,
      ai_assistance: "Brouillon assisté, non relu.",
      nature: "analyse",
      review_date: "2026-10-14",
      reviewed: false,
      pitch: "Sketch prépare votre voyage.",
      capabilities: ["Décrire des contraintes."],
      audience: "Voyageurs.",
    });
    const result = buildSite(
      [{ name: "sketch.project.v1.yaml", text: cardText("sketch", "idea") }],
      assets,
      [draft],
    );
    const html = result.files.get("produits/sketch/index.html") ?? "";
    expect(html).toContain("Situation actuelle");
    expect(html).not.toContain("Sketch prépare votre voyage.");
    expect(result.report).toMatchObject({ presentationsDrafted: 1, presentationsReviewed: 0 });
  });

  test("refuses a presentation whose project has no card", () => {
    const orphan = parsePresentation({
      project: "ghost",
      title: "Ghost",
      author: "Relecteur nommé",
      ai_assistance: "Relu.",
      nature: "analyse",
      review_date: "2026-10-14",
      reviewed: true,
      pitch: "Un produit sans fiche.",
      capabilities: ["Rien."],
      audience: "Personne.",
    });
    expect(() =>
      buildSite([{ name: "sketch.project.v1.yaml", text: cardText("sketch", "idea") }], assets, [
        orphan,
      ]),
    ).toThrow("presentation.unknown_project:ghost");
  });

  test("builds an idea card carrying an application URL and links to it (ADR 0003)", () => {
    const result = buildSite(
      [
        {
          name: "sketch.project.v1.yaml",
          text: cardText("sketch", "idea", `application_url: "https://sketch.example.test/"`),
        },
      ],
      assets,
    );
    expect(result.files.get("produits/sketch/index.html")).toContain(
      'href="https://sketch.example.test/"',
    );
  });

  test("refuses the whole build when a card has no Limites (FR-03)", () => {
    const withoutLimits = cardText("sketch", "idea").replace(
      `non_goals:\n  - "Pas d'engagement de date."`,
      "non_goals: []",
    );
    expect(() =>
      buildSite([{ name: "sketch.project.v1.yaml", text: withoutLimits }], assets),
    ).toThrow("fiche.limits_missing:sketch");
  });

  test("fails closed on an empty source instead of publishing an empty site", () => {
    expect(() => buildSite([], assets)).toThrow("cards.source_empty");
  });
});
