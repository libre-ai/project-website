/**
 * Self-hosted fonts (accord 4, ADR 0004 §4): Bricolage Grotesque for headings and Source Sans 3
 * for text, both SIL Open Font License 1.1, from the pinned @fontsource-variable packages. Each
 * file is served from this origin with its licence beside it, so `font-src 'self'` holds without
 * any remote request. Only the latin `wght` axis file ships: no other axis is used.
 */

export interface SelfHostedFont {
  readonly family: string;
  readonly file: string;
  readonly licenseFile: string;
  /** Directory of the pinned package under node_modules, where `files/` and `LICENSE` live. */
  readonly packageDir: string;
  readonly weights: string;
}

const SOURCE_SANS: SelfHostedFont = {
  family: "Source Sans 3",
  file: "source-sans-3-latin-wght-normal.woff2",
  licenseFile: "assets/fonts/LICENSE-source-sans-3.txt",
  packageDir: "@fontsource-variable/source-sans-3",
  weights: "200 900",
};

export const FONTS: readonly SelfHostedFont[] = [
  {
    family: "Bricolage Grotesque",
    file: "bricolage-grotesque-latin-wght-normal.woff2",
    licenseFile: "assets/fonts/LICENSE-bricolage-grotesque.txt",
    packageDir: "@fontsource-variable/bricolage-grotesque",
    weights: "200 800",
  },
  SOURCE_SANS,
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

// The legacy page set still reads these until the build switches over (plan, Task 9).
export const FONT_FILE = SOURCE_SANS.file;
export const FONT_LICENSE_FILE = SOURCE_SANS.licenseFile;

export function renderFontFace(): string {
  return fontFace(SOURCE_SANS);
}
