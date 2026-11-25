import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { HAND_NOTES, handCharacters } from "./content/home";
import {
  CAVEAT_SUBSET,
  FONT_FILES,
  FONTS,
  renderFontFaces,
  renderFontTokens,
  type SubsetManifest,
} from "./font";

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

  test("each face has its own file and each family its own licence file", () => {
    for (const { font, file } of FONT_FILES) {
      const face = font.faces.find((candidate) => candidate.file === file);
      expect(file).toMatch(
        face?.subset === undefined
          ? /^[a-z0-9-]+-latin-\d00-normal\.woff2$/
          : /^[a-z0-9-]+-notes-\d00-normal\.woff2$/,
      );
    }
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
      const face = font.faces.find((candidate) => candidate.file === file);
      const served =
        face?.subset === undefined ? join(root, "files", file) : join(process.cwd(), face.subset);
      expect(await Bun.file(served).exists()).toBe(true);
    }
  });

  test("handwritten notes are set in Caveat, the third family of the ADR", () => {
    expect(FONTS.find((font) => font.role === "main")?.family).toBe("Caveat");
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
    expect(css).toContain('--police-main: "Caveat", ');
    for (const line of css.split("\n").filter((l) => l.includes("--police-"))) {
      expect(line).toMatch(/", [A-Za-z][A-Za-z, -]*;$/);
    }
  });
});

describe("the Caveat subset of the handwritten notes (I-39: the file is tied to its source)", () => {
  const sha256 = async (path: string) =>
    createHash("sha256")
      .update(new Uint8Array(await Bun.file(path).arrayBuffer()))
      .digest("hex");
  const manifest = async () =>
    (await Bun.file(join(process.cwd(), CAVEAT_SUBSET.manifest)).json()) as SubsetManifest;

  test("holds exactly the characters of the notes the site draws", async () => {
    // A note with a character the subset lacks would fall back to another font, glyph by glyph;
    // a character no note uses any more would weigh on every page for nothing.
    expect((await manifest()).characters).toBe(handCharacters(HAND_NOTES));
  });

  test("the committed file is the one the script wrote", async () => {
    const recorded = await manifest();
    expect(recorded.output.file).toBe(CAVEAT_SUBSET.output);
    expect(await sha256(join(process.cwd(), CAVEAT_SUBSET.output))).toBe(recorded.output.sha256);
  });

  test("was cut from the face of the pinned package, still the same bytes", async () => {
    const recorded = await manifest();
    const root = join(process.cwd(), "node_modules", CAVEAT_SUBSET.source.package);
    const pinned = (await Bun.file(join(root, "package.json")).json()) as { version: string };
    expect(recorded.source.version).toBe(pinned.version);
    expect(await sha256(join(root, CAVEAT_SUBSET.source.file))).toBe(recorded.source.sha256);
  });

  test("handCharacters keeps each character once, in code point order", () => {
    expect(handCharacters(["bab", "ça", " a"])).toBe(" abç");
  });
});
