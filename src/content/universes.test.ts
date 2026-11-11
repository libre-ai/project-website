import { describe, expect, test } from "bun:test";

import { UNIVERSE_HUES } from "../design/palette";
import { UNIVERSE_OF, UNIVERSES, universeOf } from "./universes";

describe("universes (ADR 0007 §6)", () => {
  test("eight universes, in the arbitrated order, each with a hue", () => {
    expect(UNIVERSES.map((universe) => universe.verb)).toEqual([
      "S'informer",
      "Écrire et calculer",
      "Travailler ensemble",
      "Créer et publier",
      "Apprendre",
      "Se divertir",
      "Se protéger",
      "Piloter l'IA",
    ]);
    const ids: string[] = UNIVERSES.map((universe) => universe.id);
    expect(ids.sort()).toEqual(Object.keys(UNIVERSE_HUES).sort());
  });

  test("every application P01 to P40 belongs to exactly one universe", () => {
    const refs = Array.from({ length: 40 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`);
    expect(Object.keys(UNIVERSE_OF).sort()).toEqual(refs);
  });

  test("every universe holds at least one application", () => {
    const used = new Set(Object.values(UNIVERSE_OF));
    for (const universe of UNIVERSES) expect(used.has(universe.id)).toBe(true);
  });

  test("keeps the owner's distribution of 2026-11-11", () => {
    expect(universeOf("P40")).toBe("piloter-ia");
    expect(universeOf("P07")).toBe("apprendre");
    expect(() => universeOf("P41")).toThrow("content.universe_unknown");
  });
});
