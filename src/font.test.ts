import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { FONT_FILES, FONTS, renderFontFaces, renderFontTokens } from "./font";

// Expected families and licence copied from ADR 0010 §2, not from the code under test.
const ADR_FAMILIES = ["Literata", "Atkinson Hyperlegible Next", "Caveat"];

describe("self-hosted fonts of the Libre IA site (ADR 0010 §2)", () => {
  test("Literata sets headings and Atkinson Hyperlegible Next sets text", () => {
    expect(FONTS.find((font) => font.role === "titre")?.family).toBe("Literata");
    expect(FONTS.find((font) => font.role === "texte")?.family).toBe("Atkinson Hyperlegible Next");
  });

  test("no family outside the three of the ADR, and each one once", () => {
    for (const font of FONTS) expect(ADR_FAMILIES).toContain(font.family);
    expect(new Set(FONTS.map((font) => font.family)).size).toBe(FONTS.length);
  });

  test("text has a regular and a bold face, so body copy and its emphasis are both real faces", () => {
    const text = FONTS.find((font) => font.role === "texte");
    expect(text?.faces.map((face) => face.weight)).toEqual([400, 700]);
  });

  test("each face has its own latin file and each family its own licence file", () => {
    for (const { file } of FONT_FILES)
      expect(file).toMatch(/^[a-z0-9-]+-latin-\d00-normal\.woff2$/);
    expect(new Set(FONT_FILES.map(({ file }) => file)).size).toBe(FONT_FILES.length);
    for (const font of FONTS)
      expect(font.licenseFile).toMatch(/^assets\/fonts\/LICENSE-[a-z0-9-]+\.txt$/);
    expect(new Set(FONTS.map((font) => font.licenseFile)).size).toBe(FONTS.length);
  });

  test("each pinned package is SIL OFL 1.1 and ships the files and the licence the build copies", async () => {
    for (const { font, file } of FONT_FILES) {
      const root = join(process.cwd(), "node_modules", font.packageDir);
      const manifest = (await Bun.file(join(root, "package.json")).json()) as { license: string };
      expect(manifest.license).toBe("OFL-1.1");
      expect(await Bun.file(join(root, "LICENSE")).text()).toContain(
        "SIL Open Font License, Version 1.1",
      );
      expect(await Bun.file(join(root, "files", file)).exists()).toBe(true);
    }
  });

  test("renders one swap @font-face per face, from the local origin only", () => {
    const css = renderFontFaces();
    expect(css.match(/@font-face/g)).toHaveLength(FONT_FILES.length);
    expect(css.match(/font-display: swap;/g)).toHaveLength(FONT_FILES.length);
    for (const font of FONTS) {
      expect(css).toContain(`font-family: "${font.family}";`);
      for (const face of font.faces) expect(css).toContain(`url("/assets/fonts/${face.file}")`);
    }
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
  });

  test("exposes each family through a --police-<role> property, with a system fallback", () => {
    const css = renderFontTokens();
    expect(css).toContain('--police-titre: "Literata", ');
    expect(css).toContain('--police-texte: "Atkinson Hyperlegible Next", ');
    for (const line of css.split("\n").filter((l) => l.includes("--police-"))) {
      expect(line).toMatch(/", [A-Za-z][A-Za-z, -]*;$/);
    }
  });
});
