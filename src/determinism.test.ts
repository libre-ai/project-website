import { describe, expect, test } from "bun:test";

import { diffOutputs } from "./determinism";
import { buildSite } from "./site";
import { validProjection } from "./test-fixtures";

const files = (entries: [string, string | Uint8Array][]) => new Map(entries);

describe("diffOutputs (S6.4)", () => {
  test("identical outputs have no difference", () => {
    const a = files([
      ["a.html", "x"],
      ["b.bin", new Uint8Array([1, 2])],
    ]);
    const b = files([
      ["b.bin", new Uint8Array([1, 2])],
      ["a.html", "x"],
    ]);
    expect(diffOutputs(a, b)).toEqual([]);
  });

  test("a changed text file, a changed binary and a missing path are each named", () => {
    const a = files([
      ["a.html", "x"],
      ["b.bin", new Uint8Array([1, 2])],
      ["only-a.txt", "y"],
    ]);
    const b = files([
      ["a.html", "z"],
      ["b.bin", new Uint8Array([1, 3])],
      ["only-b.txt", "y"],
    ]);
    expect(diffOutputs(a, b)).toEqual(["a.html", "b.bin", "only-a.txt", "only-b.txt"]);
  });
});

describe("buildSite is deterministic", () => {
  const cardText = [
    `schema_version: "1.0"`,
    `project: sketch`,
    `repository: libre-ai/sketch`,
    `kind: satellite`,
    `layer: couche-2`,
    `dependencies: []`,
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
  const assets = { tokens: ":root{}", styles: "body{}" };

  test("two assemblies of the same input produce the same bytes", () => {
    const run = () =>
      buildSite([{ name: "sketch.project.v1.yaml", text: cardText }], assets, {
        brand: validProjection.copy.fr,
      });
    expect(diffOutputs(run().files, run().files)).toEqual([]);
  });
});
