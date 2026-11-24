/**
 * Self-hosted fonts (ADR 0010 §2, amending ADR 0004 §4): Literata for headings, Atkinson
 * Hyperlegible Next for text, Caveat for the handwritten notes of illustrations only. All three are
 * SIL Open Font License 1.1, from the pinned @fontsource-variable packages. Each file is served from
 * this origin with its licence beside it, so `font-src 'self'` holds without any remote request.
 * Only the latin `wght` axis file ships: no other axis is used.
 */

/** What a family is for; each role becomes a `--police-<role>` custom property. */
export type FontRole = "titre" | "texte" | "main";

export interface SelfHostedFont {
  readonly family: string;
  readonly role: FontRole;
  /** System families used while the file loads or if it fails (`font-display: swap`). */
  readonly fallback: string;
  readonly file: string;
  readonly licenseFile: string;
  /** Directory of the pinned package under node_modules, where `files/` and `LICENSE` live. */
  readonly packageDir: string;
  readonly weights: string;
}

export const FONTS: readonly SelfHostedFont[] = [
  {
    family: "Literata",
    role: "titre",
    fallback: "Georgia, serif",
    file: "literata-latin-wght-normal.woff2",
    licenseFile: "assets/fonts/LICENSE-literata.txt",
    packageDir: "@fontsource-variable/literata",
    weights: "200 900",
  },
  {
    family: "Atkinson Hyperlegible Next",
    role: "texte",
    fallback: "system-ui, sans-serif",
    file: "atkinson-hyperlegible-next-latin-wght-normal.woff2",
    licenseFile: "assets/fonts/LICENSE-atkinson-hyperlegible-next.txt",
    packageDir: "@fontsource-variable/atkinson-hyperlegible-next",
    weights: "200 800",
  },
  {
    family: "Caveat",
    role: "main",
    fallback: "cursive",
    file: "caveat-latin-wght-normal.woff2",
    licenseFile: "assets/fonts/LICENSE-caveat.txt",
    packageDir: "@fontsource-variable/caveat",
    weights: "400 700",
  },
];

function fontFace(font: SelfHostedFont): string {
  return [
    "@font-face {",
    `  font-family: "${font.family}";`,
    `  src: url("/assets/fonts/${font.file}") format("woff2");`,
    `  font-weight: ${font.weights};`,
    "  font-style: normal;",
    "  font-display: swap;",
    "}",
    "",
  ].join("\n");
}

export function renderFontFaces(): string {
  return FONTS.map(fontFace).join("");
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
