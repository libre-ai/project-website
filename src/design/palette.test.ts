import { describe, expect, test } from "bun:test";

import { AUBE, contrastRatio, facetShades, oklchToHex, UNIVERSE_HUES } from "./palette";

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

describe("Aube palette", () => {
  test("keeps the arbitrated base colours (ADR 0004)", () => {
    expect(AUBE).toMatchObject({
      fond: "#f4f8f6",
      encre: "#0a2a1e",
      emeraude: "#0ba360",
      ciel: "#3cb9e8",
    });
  });

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
