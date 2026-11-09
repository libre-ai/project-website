import { describe, expect, test } from "bun:test";

import { FONT_FILE, FONT_LICENSE_FILE, renderFontFace } from "./font";

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
