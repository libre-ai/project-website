import { describe, expect, test } from "bun:test";

import { FONTS } from "../font";
import { readStaticSheets, renderStylesheet } from "./stylesheet";

const sheets = await readStaticSheets();
const css = await renderStylesheet();

describe("site stylesheet (ADR 0004, ADR 0005)", () => {
  test("holds the font faces, the Aube tokens and every static sheet, in that order", () => {
    const font = css.indexOf("@font-face");
    const tokens = css.indexOf(":root {");
    expect(font).toBeGreaterThan(-1);
    expect(font).toBeLessThan(tokens);
    for (const sheet of sheets) expect(css).toContain(sheet.text.trim());
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "base.css",
      "layout.css",
      "components.css",
      "demos.css",
      "effects.css",
    ]);
  });

  test("loads nothing remote and imports nothing", () => {
    expect(css).not.toContain("@import");
    const urls = [...css.matchAll(/url\(\s*"?([^")]+)"?\s*\)/g)].map((match) => match[1]);
    expect(urls.sort()).toEqual(FONTS.map((font) => `/assets/fonts/${font.file}`).sort());
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
