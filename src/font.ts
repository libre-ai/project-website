/**
 * Self-hosted font (accord 4): Source Sans 3, SIL Open Font License 1.1, from the pinned
 * @fontsource-variable/source-sans-3 package. The file is served from this origin, so the
 * Caddyfile font-src 'self' rule holds without any remote request.
 */

export const FONT_FILE = "source-sans-3-latin-wght-normal.woff2";
export const FONT_LICENSE_FILE = "assets/fonts/LICENSE-source-sans-3.txt";

export function renderFontFace(): string {
  return [
    "@font-face {",
    '  font-family: "Source Sans 3";',
    `  src: url("/assets/fonts/${FONT_FILE}") format("woff2");`,
    "  font-weight: 200 900;",
    "  font-style: normal;",
    "  font-display: swap;",
    "}",
    "",
  ].join("\n");
}
