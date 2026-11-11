import { describe, expect, test } from "bun:test";

import { FONT_FILE, FONT_LICENSE_FILE, FONTS, renderFontFace, renderFontFaces } from "./font";

describe("self-hosted fonts of the Libre IA site (ADR 0004 §4)", () => {
  test("declares the display and text families, each with its own file and licence", () => {
    expect(FONTS.map((font) => font.family)).toEqual(["Bricolage Grotesque", "Source Sans 3"]);
    for (const font of FONTS) {
      expect(font.file).toMatch(/^[a-z0-9-]+-latin-wght-normal\.woff2$/);
      expect(font.licenseFile).toMatch(/^assets\/fonts\/LICENSE-[a-z0-9-]+\.txt$/);
    }
    expect(new Set(FONTS.map((font) => font.licenseFile)).size).toBe(FONTS.length);
  });

  test("renders one swap @font-face per family, from the local origin only", () => {
    const css = renderFontFaces();
    expect(css.match(/@font-face/g)).toHaveLength(FONTS.length);
    expect(css.match(/font-display: swap;/g)).toHaveLength(FONTS.length);
    for (const font of FONTS) expect(css).toContain(`url("/assets/fonts/${font.file}")`);
    expect(css).not.toMatch(/url\("?(https?:)?\/\//);
  });
});

describe("self-hosted font (accord 4 : police SIL OFL auto-hébergée)", () => {
  test("the @font-face rule points at the font file the build ships", () => {
    expect(renderFontFace()).toContain(`url("/assets/fonts/${FONT_FILE}")`);
  });

  test("the font is served from the same origin only, never a remote host", () => {
    expect(renderFontFace()).not.toMatch(/url\("https?:/);
  });

  test("the licence file travels with the font", () => {
    expect(FONT_LICENSE_FILE).toMatch(/^assets\/fonts\/LICENSE-/);
  });
});
