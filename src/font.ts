/**
 * Self-hosted fonts (ADR 0010 §2, amending ADR 0004 §4): Literata for headings and Atkinson
 * Hyperlegible Next for text, both SIL Open Font License 1.1, from the pinned @fontsource packages.
 * Each file is served from this origin with its licence beside it, so `font-src 'self'` holds
 * without any remote request.
 *
 * Static latin faces, not the variable files: every page counts every face its stylesheet declares
 * (src/budget.ts), and the variable files of the two families weigh 86,492 bytes against 46,832
 * for these three faces (measured 2026-11-24 on the 5.3.0 packages). The sheets ask for 600, 700
 * and 800; CSS font matching renders each of them with the 700 face, the nearest available.
 * Caveat, the third family of ADR 0010 §2, is for the handwritten notes of illustrations only. Its
 * latin face would count 51,220 bytes on every page, so the site serves a subset of it holding only
 * the characters of the notes, cut by tools/fonts/subset-caveat.ts and kept in the repository with
 * its manifest (CAVEAT_SUBSET).
 */

/** What a family is for; each role becomes a `--police-<role>` custom property. */
export type FontRole = "titre" | "texte" | "main";

export interface FontFace {
  readonly weight: 400 | 600 | 700;
  /** Served as /assets/fonts/<file>. */
  readonly file: string;
  /** Repository path of a subset cut from the package; absent, the file comes from the package. */
  readonly subset?: string;
}

/** Where the Caveat subset comes from and where it lives (tools/fonts/subset-caveat.ts). */
export const CAVEAT_SUBSET = {
  source: { package: "@fontsource/caveat", file: "files/caveat-latin-600-normal.woff2" },
  output: "src/design/fonts/caveat-notes-600-normal.woff2",
  manifest: "src/design/fonts/caveat-notes.json",
} as const;

/** What the subset script records, so a test can tie the served file to its source. */
export interface SubsetManifest {
  readonly source: {
    readonly package: string;
    readonly version: string;
    readonly file: string;
    readonly sha256: string;
  };
  readonly tool: string;
  /** The characters kept, each once, in code point order. */
  readonly characters: string;
  readonly output: { readonly file: string; readonly sha256: string; readonly bytes: number };
}

export interface SelfHostedFont {
  readonly family: string;
  readonly role: FontRole;
  /** System families used while a file loads or if it fails (`font-display: swap`). */
  readonly fallback: string;
  readonly faces: readonly FontFace[];
  readonly licenseFile: string;
  /** Directory of the pinned package under node_modules, where `files/` and `LICENSE` live. */
  readonly packageDir: string;
}

export const FONTS: readonly SelfHostedFont[] = [
  {
    family: "Literata",
    role: "titre",
    fallback: "Georgia, serif",
    faces: [{ weight: 700, file: "literata-latin-700-normal.woff2" }],
    licenseFile: "assets/fonts/LICENSE-literata.txt",
    packageDir: "@fontsource/literata",
  },
  {
    family: "Atkinson Hyperlegible Next",
    role: "texte",
    fallback: "system-ui, sans-serif",
    faces: [
      { weight: 400, file: "atkinson-hyperlegible-next-latin-400-normal.woff2" },
      { weight: 700, file: "atkinson-hyperlegible-next-latin-700-normal.woff2" },
    ],
    licenseFile: "assets/fonts/LICENSE-atkinson-hyperlegible-next.txt",
    packageDir: "@fontsource/atkinson-hyperlegible-next",
  },
  {
    family: "Caveat",
    role: "main",
    fallback: "cursive",
    faces: [{ weight: 600, file: "caveat-notes-600-normal.woff2", subset: CAVEAT_SUBSET.output }],
    licenseFile: "assets/fonts/LICENSE-caveat.txt",
    packageDir: CAVEAT_SUBSET.source.package,
  },
];

/** Every served font file, with the family it belongs to. */
export const FONT_FILES: readonly { readonly font: SelfHostedFont; readonly file: string }[] =
  FONTS.flatMap((font) => font.faces.map((face) => ({ font, file: face.file })));

function fontFace(font: SelfHostedFont, face: FontFace): string {
  return [
    "@font-face {",
    `  font-family: "${font.family}";`,
    `  src: url("/assets/fonts/${face.file}") format("woff2");`,
    `  font-weight: ${face.weight};`,
    "  font-style: normal;",
    "  font-display: swap;",
    "}",
    "",
  ].join("\n");
}

export function renderFontFaces(): string {
  return FONTS.flatMap((font) => font.faces.map((face) => fontFace(font, face))).join("");
}

/** One `--police-<role>` property per family, so the sheets never spell a family name. */
export function renderFontTokens(): string {
  return [
    ":root {",
    ...FONTS.map((font) => `  --police-${font.role}: "${font.family}", ${font.fallback};`),
    "}",
    "",
  ].join("\n");
}
