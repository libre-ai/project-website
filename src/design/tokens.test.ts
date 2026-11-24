import { describe, expect, test } from "bun:test";

import { UNIVERSE_HUES } from "./palette";
import { renderTokens, TOKEN_PAIRS } from "./tokens";

const css = renderTokens();

/** The declarations of the first rule whose selector is exactly `selector`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {\n`);
  if (start === -1) throw new Error(`no rule ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

function value(rule: string, property: string): string | undefined {
  return new RegExp(`\\n\\s*--${property}: ([^;]+);`).exec(rule)?.[1];
}

// sRGB hex → OKLCH (Björn Ottosson, 2020), written independently of palette.ts, which only goes
// the other way: the test reads back what the stylesheet actually serves after 8-bit rounding.
function oklch(hex: string): { readonly l: number; readonly c: number } {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const v = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, c: Math.hypot(a, bb) };
}

describe("token contrast (ADR 0004 §3, unchanged by ADR 0010)", () => {
  test("covers both themes, the night, the four roles and every universe", () => {
    const names = TOKEN_PAIRS.map((pair) => pair.name);
    for (const theme of ["clair", "sombre"]) {
      expect(names).toContain(`${theme}:encre/fond`);
      expect(names).toContain(`${theme}:nuit-texte/nuit`);
      for (const role of ["personne", "agent", "controle", "incident"]) {
        expect(names).toContain(`${theme}:${role}/fond`);
        expect(names).toContain(`${theme}:${role}/surface`);
        expect(names).toContain(`${theme}:${role}/${role}-fond`);
      }
      for (const id of Object.keys(UNIVERSE_HUES)) {
        expect(names).toContain(`${theme}:univers-${id}:texte/teinte`);
      }
    }
  });

  test.each(
    TOKEN_PAIRS.map((pair) => [pair.name, pair] as const),
  )("%s meets its minimum ratio", (_name, pair) => {
    expect(pair.ratio).toBeGreaterThanOrEqual(pair.minimum);
  });

  test("every pair is one the stylesheet serves", () => {
    for (const pair of TOKEN_PAIRS) {
      expect(css).toContain(pair.foreground);
      expect(css).toContain(pair.background);
    }
  });
});

// Expected values copied from ADR 0010 §1.
describe("renderTokens (ADR 0010 §1)", () => {
  test("is deterministic", () => {
    expect(renderTokens()).toBe(css);
  });

  test("light is the default: paper, ink and night, then the four role colours", () => {
    const light = block(":root");
    expect(value(light, "fond")).toBe("#fbfaf7");
    expect(value(light, "encre")).toBe("#15213b");
    expect(value(light, "nuit")).toBe("#15213b");
    expect(value(light, "personne")).toBe("#875000");
    expect(value(light, "agent")).toBe("#1f5bb5");
    expect(value(light, "controle")).toBe("#1b6e45");
    expect(value(light, "incident")).toBe("#a8291f");
    expect(light).toContain("color-scheme: light;");
  });

  test("dark is a variant, chosen explicitly or by the system unless light was chosen", () => {
    const dark = block(':root[data-theme="sombre"]');
    expect(dark).toContain("color-scheme: dark;");
    const system = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(system).toContain(':root:not([data-theme="clair"]) {');
    for (const property of ["fond", "encre", "nuit", "personne", "agent", "controle", "incident"]) {
      expect(value(dark, property)).toMatch(/^#[0-9a-f]{6}$/);
      expect(value(dark, property)).not.toBe(value(block(":root"), property));
      expect(system).toContain(`--${property}: ${value(dark, property)};`);
    }
    // The site's own theme names, never the prototype's light/dark attribute values.
    expect(css).not.toMatch(/data-theme="(light|dark)"/);
  });

  test("declares one class per universe with its colour, tint, text colour and five facets", () => {
    for (const id of Object.keys(UNIVERSE_HUES)) {
      const rule = block(`.univers-${id}`);
      for (const property of ["couleur", "teinte", "couleur-texte", "facette-5"]) {
        expect(value(rule, property)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  // 8-bit rounding moves OKLCH lightness and chroma by a few thousandths at most; clamping an
  // out-of-gamut colour moves them by hundredths, which is what this tolerance must catch.
  const TOLERANCE = 0.006;
  test.each([
    ["clair", ""],
    ["sombre", ':root[data-theme="sombre"] '],
  ])("%s universe colours and tints share one lightness and one chroma in OKLCH", (_theme, prefix) => {
    for (const property of ["couleur", "teinte"]) {
      const tones = Object.keys(UNIVERSE_HUES).map((id) =>
        oklch(value(block(`${prefix}.univers-${id}`), property) ?? ""),
      );
      const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
      expect(spread(tones.map((tone) => tone.l))).toBeLessThanOrEqual(TOLERANCE);
      expect(spread(tones.map((tone) => tone.c))).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  test("uses only hex colours and custom properties, never a remote reference", () => {
    expect(css).not.toContain("url(");
    expect(css).not.toContain("@import");
  });
});
