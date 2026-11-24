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
 * Caveat, the third family of ADR 0010 §2, is for the handwritten notes of illustrations only: no
 * page draws one yet, and it is added with the first illustration that does (48,836 bytes for its
 * lightest latin face would otherwise count on every page).
 */

/** What a family is for; each role becomes a `--police-<role>` custom property. */
export type FontRole = "titre" | "texte";

export interface FontFace {
  readonly weight: 400 | 700;
  readonly file: string;
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
