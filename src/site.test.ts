import { describe, expect, test } from "bun:test";

import { buildSite } from "./site";

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
      fixedPages: 8,
      resourcesExamined: 0,
      textsExamined: result.report.textsExamined,
      claimViolations: 0,
    });
    expect(result.report.textsExamined).toBeGreaterThan(0);
  });

  test("refuses the whole build when an idea card carries an application URL (FR-02)", () => {
    expect(() =>
      buildSite(
        [
          {
            name: "sketch.project.v1.yaml",
            text: cardText("sketch", "idea", `application_url: "https://sketch.example.test/"`),
          },
        ],
        assets,
      ),
    ).toThrow("fiche.application_url_forbidden:sketch");
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
