import { describe, expect, test } from "bun:test";

import { renderSiteCss } from "./styles";

const NO_PREFERENCE = "@media (prefers-reduced-motion: no-preference)";

// The text of every block opened by `header`, braces matched (nested blocks stay inside).
function blocks(css: string, header: string): string[] {
  const found: string[] = [];
  let from = css.indexOf(header);
  while (from !== -1) {
    const open = css.indexOf("{", from);
    let depth = 0;
    let end = open;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === "{") depth += 1;
      if (css[index] === "}") depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
    found.push(css.slice(open + 1, end));
    from = css.indexOf(header, end);
  }
  return found;
}

const strip = (css: string) => css.replaceAll(/\/\*[\s\S]*?\*\//g, "");

describe("bounded motion (O5, S4.1)", () => {
  const css = strip(renderSiteCss());
  const allowed = blocks(css, NO_PREFERENCE).join("\n");

  test("at least one appearance is defined, under no-preference only", () => {
    expect(blocks(css, NO_PREFERENCE).length).toBeGreaterThan(0);
    expect(allowed).toMatch(/@keyframes\s+[\w-]+/);
    expect(allowed).toMatch(/animation:/);
  });

  test("no @keyframes and no animation declaration exist outside that block", () => {
    let outside = css;
    for (const inner of blocks(css, NO_PREFERENCE)) outside = outside.replace(inner, "");
    expect(outside).not.toMatch(/@keyframes/);
    expect(outside).not.toMatch(/animation\s*:/);
    expect(outside).not.toMatch(/animation-name\s*:/);
  });

  test("the appearance does not touch opacity: contrast is constant while it plays", () => {
    expect(allowed).not.toMatch(/opacity/);
  });

  test("the motion is finite and short (no infinite loop)", () => {
    expect(allowed).not.toMatch(/infinite/);
    const duration = allowed.match(/animation:\s*[\w-]+\s+([\d.]+)(m?s)/);
    expect(duration).not.toBeNull();
    const seconds = Number(duration?.[1]) * (duration?.[2] === "ms" ? 0.001 : 1);
    expect(seconds).toBeLessThanOrEqual(0.4);
  });

  test("the reduce block still turns transitions off", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*transition:\s*none/);
  });
});
