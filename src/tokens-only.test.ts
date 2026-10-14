import { describe, expect, test } from "bun:test";

import { buildSite } from "./site";

// G7: colours come from tokens.css only. The stylesheet is the single place where a hex value
// may appear; every other produced file must be free of literal colours.
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const OLD_STATE_NAMES = /\b(discovery|private-alpha|public-alpha|stable)\b/;

const assets = {
  tokens: ":root { --lai-color-ink: #110f0c; }\n",
  styles: "body { color: var(--lai-color-ink); }\n",
};
const cardText = [
  `schema_version: "1.0"`,
  `project: sketch`,
  `repository: libre-ai/sketch`,
  `exposure: idea`,
  `maturity: idea`,
  `summary: "Résumé court."`,
  `current_situation: "Aucun code n'existe encore à ce stade."`,
  `non_goals:`,
  `  - "Pas d'engagement de date."`,
  `freshness:`,
  `  last_verified_on: "2026-10-08"`,
  "",
].join("\n");

const result = buildSite([{ name: "sketch.project.v1.yaml", text: cardText }], assets);

describe("G7 : tokens uniquement dans les sorties", () => {
  test("no literal colour appears in any produced file except tokens.css", () => {
    const offenders = [...result.files]
      .filter(([path]) => path !== "assets/tokens.css")
      .filter(([, content]) => HEX.test(content))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  test("the stylesheet that defines the tokens is the only place a hex value is allowed", () => {
    expect(HEX.test(result.files.get("assets/tokens.css") ?? "")).toBe(true);
  });
});

describe("DIAG-5 : aucun ancien nom d'état dans le site produit", () => {
  test("no produced file uses a superseded exposure or maturity name", () => {
    const offenders = [...result.files]
      .filter(([, content]) => OLD_STATE_NAMES.test(content))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
