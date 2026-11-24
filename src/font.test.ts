import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { FONTS, renderFontFaces, renderFontTokens } from "./font";

// Expected families and licence copied from ADR 0010 §2, not from the code under test.
describe("self-hosted fonts of the Libre IA site (ADR 0010 §2)", () => {
  test("Literata for headings, Atkinson Hyperlegible Next for text, Caveat for annotations", () => {
    expect(FONTS.map((font) => [font.role, font.family])).toEqual([
      ["titre", "Literata"],
      ["texte", "Atkinson Hyperlegible Next"],
      ["main", "Caveat"],
    ]);
  });

  test("each family has its own file and its own licence file", () => {
    for (const font of FONTS) {
      expect(font.file).toMatch(/^[a-z0-9-]+-latin-wght-normal\.woff2$/);
      expect(font.licenseFile).toMatch(/^assets\/fonts\/LICENSE-[a-z0-9-]+\.txt$/);
    }
    expect(new Set(FONTS.map((font) => font.file)).size).toBe(FONTS.length);
    expect(new Set(FONTS.map((font) => font.licenseFile)).size).toBe(FONTS.length);
  });

  test("each pinned package is SIL OFL 1.1 and ships the file and the licence the build copies", async () => {
    for (const font of FONTS) {
      const root = join(process.cwd(), "node_modules", font.packageDir);
      const manifest = (await Bun.file(join(root, "package.json")).json()) as { license: string };
      expect(manifest.license).toBe("OFL-1.1");
      expect(await Bun.file(join(root, "LICENSE")).text()).toContain(
        "SIL Open Font License, Version 1.1",
      );
      expect(await Bun.file(join(root, "files", font.file)).exists()).toBe(true);
    }
  });

  test("renders one swap @font-face per family, from the local origin only", () => {
    const css = renderFontFaces();
    expect(css.match(/@font-face/g)).toHaveLength(FONTS.length);
    expect(css.match(/font-display: swap;/g)).toHaveLength(FONTS.length);
    for (const font of FONTS) {
      expect(css).toContain(`font-family: "${font.family}";`);
      expect(css).toContain(`url("/assets/fonts/${font.file}")`);
    }
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
  });

  test("exposes each family through a --police-<role> property, with a system fallback", () => {
    const css = renderFontTokens();
    expect(css).toContain('--police-titre: "Literata", ');
    expect(css).toContain('--police-texte: "Atkinson Hyperlegible Next", ');
    expect(css).toContain('--police-main: "Caveat", ');
    for (const line of css.split("\n").filter((l) => l.includes("--police-"))) {
      expect(line).toMatch(/", [A-Za-z][A-Za-z, -]*;$/);
    }
  });
});
