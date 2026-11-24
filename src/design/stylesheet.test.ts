import { describe, expect, test } from "bun:test";

import { FONT_FILES, renderFontFaces, renderFontTokens } from "../font";
import { readStaticSheets, renderStylesheet } from "./stylesheet";
import { renderTokens } from "./tokens";

const sheets = await readStaticSheets();
const css = await renderStylesheet();

/** The declarations of the first rule whose selector is exactly `selector`, in `text`. */
function rule(text: string, selector: string): string {
  const start = text.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no rule ${selector}`);
  return text.slice(start, text.indexOf("}", start));
}

describe("site stylesheet (ADR 0004, ADR 0005, ADR 0010)", () => {
  test("holds the font faces, the font and colour tokens, then every static sheet, in order", () => {
    const positions = [renderFontFaces(), renderFontTokens(), renderTokens()].map((part) =>
      css.indexOf(part),
    );
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    let previous = positions.at(-1) ?? 0;
    for (const sheet of sheets) {
      const position = css.indexOf(sheet.text.trim());
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "base.css",
      "layout.css",
      "components.css",
      "pages.css",
      "demos.css",
      "effects.css",
    ]);
  });

  test("loads nothing remote and imports nothing: its only URLs are the self-hosted fonts", () => {
    expect(css).not.toContain("@import");
    const urls = [...css.matchAll(/url\(\s*"?([^")]+)"?\s*\)/g)].map((match) => match[1]);
    expect(urls.sort()).toEqual(FONT_FILES.map(({ file }) => `/assets/fonts/${file}`).sort());
  });

  // ADR 0010 §2: Literata for headings, Atkinson Hyperlegible Next for text.
  test("sets text in the text family and headings in the heading family", () => {
    const base = sheets.find((sheet) => sheet.name === "base.css")?.text ?? "";
    expect(rule(base, "body")).toContain("font-family: var(--police-texte);");
    expect(rule(base, "h1,\nh2,\nh3")).toContain("font-family: var(--police-titre);");
  });

  test("no static sheet spells a font family: every family goes through a --police token", () => {
    for (const sheet of sheets) {
      for (const [, value] of sheet.text.matchAll(/font-family:\s*([^;]+);/g)) {
        expect(value).toMatch(/^(var\(--police-(titre|texte|main)\)|inherit)$/);
      }
    }
  });

  test("only the effects sheet moves anything, and only without a reduced-motion preference", () => {
    for (const sheet of sheets.filter((sheet) => sheet.name !== "effects.css")) {
      expect(sheet.text).not.toMatch(/\b(animation|transition)\s*:|@keyframes/);
    }
    const effects = sheets.find((sheet) => sheet.name === "effects.css")?.text.trim() ?? "";
    expect(effects.startsWith("@media (prefers-reduced-motion: no-preference) {")).toBe(true);
    expect(effects.endsWith("}")).toBe(true);
    // The guard block is the whole sheet: its braces close only at the very end.
    let depth = 0;
    for (let i = 0; i < effects.length; i += 1) {
      if (effects[i] === "{") depth += 1;
      if (effects[i] === "}") depth -= 1;
      if (depth === 0 && i > effects.indexOf("{")) expect(i).toBe(effects.length - 1);
    }
  });

  test("never uses !important", () => {
    expect(css).not.toContain("!important");
  });

  test("is deterministic", async () => {
    expect(await renderStylesheet()).toBe(css);
  });
});
