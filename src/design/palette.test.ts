import { describe, expect, test } from "bun:test";

import { renderSprite } from "../brand/sprite";
import {
  contrastRatio,
  facetShades,
  MARTINET,
  oklchToHex,
  PAPIER_NUIT,
  ROLES,
  THEMES,
  UNIVERSE_HUES,
} from "./palette";

describe("oklchToHex", () => {
  test("reproduces the achromatic end points", () => {
    expect(oklchToHex(1, 0, 0)).toBe("#ffffff");
    expect(oklchToHex(0, 0, 0)).toBe("#000000");
  });

  test("maps a mid grey to the same value on the three channels", () => {
    const hex = oklchToHex(0.6, 0, 0);
    expect(hex.slice(1, 3)).toBe(hex.slice(3, 5));
    expect(hex.slice(3, 5)).toBe(hex.slice(5, 7));
  });

  test("clamps an out-of-gamut colour instead of producing an invalid hex", () => {
    expect(oklchToHex(0.7, 0.4, 145)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("contrastRatio (WCAG 2.2)", () => {
  test("black on white is 21:1 and is symmetric", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  test("matches the reference value of #777777 on white", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  test("refuses a value that is not a six-digit hex colour", () => {
    expect(() => contrastRatio("#fff", "#ffffff")).toThrow("palette.hex_invalid");
  });
});

// The expected values are copied from ADR 0010 §1, not from the code under test.
describe("paper and night palette (ADR 0010 §1)", () => {
  test("light, the default theme, is paper #fbfaf7 with ink and night #15213b", () => {
    expect(THEMES).toEqual(["clair", "sombre"]);
    expect(PAPIER_NUIT.clair).toMatchObject({
      fond: "#fbfaf7",
      encre: "#15213b",
      nuit: "#15213b",
    });
  });

  test("the four role colours of the light theme are amber, blue, green and brick", () => {
    expect(ROLES.clair.personne.couleur).toBe("#875000");
    expect(ROLES.clair.agent.couleur).toBe("#1f5bb5");
    expect(ROLES.clair.controle.couleur).toBe("#1b6e45");
    expect(ROLES.clair.incident.couleur).toBe("#a8291f");
  });

  test("light reads dark ink on light paper, its dark variant the reverse", () => {
    const luminance = (hex: string) => contrastRatio(hex, "#000000");
    expect(luminance(PAPIER_NUIT.clair.fond)).toBeGreaterThan(luminance(PAPIER_NUIT.clair.encre));
    expect(luminance(PAPIER_NUIT.sombre.fond)).toBeLessThan(luminance(PAPIER_NUIT.sombre.encre));
  });

  test("the four roles are told apart in each theme", () => {
    for (const theme of THEMES) {
      const colours = Object.values(ROLES[theme]).map((role) => role.couleur);
      expect(new Set(colours).size).toBe(4);
    }
  });
});

describe("martinet colours (ADR 0010: the martinet is kept)", () => {
  test("are the stops of the gradient the sprite draws, so the mark cannot drift from it", () => {
    const sprite = renderSprite();
    for (const stop of [MARTINET.queue, MARTINET.milieu, MARTINET.tete]) {
      expect(sprite).toContain(`stop-color="${stop}"`);
    }
  });
});

describe("universe hues and facets (ADR 0004, unchanged by ADR 0010)", () => {
  test("declares eight universe hues at least 40 degrees apart", () => {
    const hues = Object.values(UNIVERSE_HUES).sort((a, b) => a - b);
    expect(hues).toHaveLength(8);
    const gaps = hues.map((hue, i) => ((hues[(i + 1) % hues.length] ?? 0) - hue + 360) % 360);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(40);
  });

  test("facet shades go from the lit facet to the shadowed one", () => {
    const shades = facetShades(155);
    expect(shades).toHaveLength(5);
    const luminance = shades.map((hex) => contrastRatio(hex, "#000000"));
    for (let i = 1; i < luminance.length; i += 1) {
      expect(luminance[i]).toBeLessThan(luminance[i - 1] ?? 0);
    }
  });
});
