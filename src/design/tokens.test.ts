import { describe, expect, test } from "bun:test";

import { UNIVERSE_HUES } from "./palette";
import { renderTokens, TOKEN_PAIRS } from "./tokens";

describe("token contrast (ADR 0004 §3)", () => {
  test("covers both themes and every universe", () => {
    const names = TOKEN_PAIRS.map((pair) => pair.name);
    expect(names.some((name) => name.startsWith("clair:"))).toBe(true);
    expect(names.some((name) => name.startsWith("sombre:"))).toBe(true);
    for (const id of Object.keys(UNIVERSE_HUES)) {
      expect(names).toContain(`clair:univers-${id}:texte/teinte`);
      expect(names).toContain(`sombre:univers-${id}:texte/teinte`);
    }
  });

  test.each(
    TOKEN_PAIRS.map((pair) => [pair.name, pair] as const),
  )("%s meets its minimum ratio", (_name, pair) => {
    expect(pair.ratio).toBeGreaterThanOrEqual(pair.minimum);
  });
});

describe("renderTokens", () => {
  const css = renderTokens();

  test("is deterministic", () => {
    expect(renderTokens()).toBe(css);
  });

  test("declares light by default, an explicit dark theme and the system dark preference", () => {
    expect(css).toContain(":root {");
    expect(css).toContain(':root[data-theme="sombre"] {');
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain(':root:not([data-theme="clair"])');
  });

  test("declares one class per universe with its colour, tint, text colour and five facets", () => {
    for (const id of Object.keys(UNIVERSE_HUES)) {
      const block = css.slice(css.indexOf(`.univers-${id} {`));
      expect(block).toContain("--couleur:");
      expect(block).toContain("--teinte:");
      expect(block).toContain("--couleur-texte:");
      expect(block).toContain("--facette-5:");
    }
  });

  test("uses only hex colours and custom properties, never a remote reference", () => {
    expect(css).not.toContain("url(");
    expect(css).not.toContain("@import");
  });
});
