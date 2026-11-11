/**
 * Design tokens as CSS custom properties (ADR 0004). Light is the default theme; dark applies when
 * the visitor chose it (`data-theme="sombre"`) or when the system prefers it and no explicit light
 * choice was made. Text colours are derived by `readableOn`, then every pair is listed in
 * TOKEN_PAIRS so the test can hold each one to its WCAG minimum.
 */
import { AUBE, contrastRatio, facetShades, oklchToHex, UNIVERSE_HUES } from "./palette";

export type Theme = "clair" | "sombre";

export interface TokenPair {
  readonly name: string;
  readonly foreground: string;
  readonly background: string;
  /** 4.5 for body text, 3 for large text and interface boundaries (WCAG 1.4.3, 1.4.11). */
  readonly minimum: 3 | 4.5;
  readonly ratio: number;
}

// A small margin keeps a colour above its threshold once browsers round it to 8 bits per channel.
const MARGIN = 0.1;
const STEP = 0.005;

/**
 * Walks OKLCH lightness from `start` towards black or white, at fixed hue and chroma, and returns
 * the first colour that reaches `minimum` against `background`. Deterministic: same input, same hex.
 */
export function readableOn(
  background: string,
  hue: number,
  chroma: number,
  minimum: 3 | 4.5,
  start: number,
): string {
  const lighter = contrastRatio(background, "#000000") < contrastRatio(background, "#ffffff");
  for (let step = 0; step <= Math.ceil(1 / STEP); step += 1) {
    const lightness = lighter ? start + step * STEP : start - step * STEP;
    if (lightness < 0 || lightness > 1) break;
    const candidate = oklchToHex(lightness, chroma, hue);
    if (contrastRatio(candidate, background) >= minimum + MARGIN) return candidate;
  }
  throw new Error(`tokens.unreachable_contrast:${background}:${hue}:${minimum}`);
}

const BASE_HUE = 160;

interface ThemeColours {
  readonly fond: string;
  readonly surface: string;
  readonly encre: string;
  readonly attenuee: string;
  readonly lien: string;
  readonly bordure: string;
  readonly focus: string;
}

function themeColours(theme: Theme): ThemeColours {
  if (theme === "clair") {
    return {
      fond: AUBE.fond,
      surface: AUBE.surface,
      encre: AUBE.encre,
      attenuee: readableOn(AUBE.fond, BASE_HUE, 0.03, 4.5, 0.6),
      lien: readableOn(AUBE.fond, 155, 0.13, 4.5, 0.6),
      bordure: readableOn(AUBE.surface, BASE_HUE, 0.02, 3, 0.75),
      focus: readableOn(AUBE.fond, 235, 0.14, 3, 0.65),
    };
  }
  const fond = oklchToHex(0.2, 0.025, 165);
  const surface = oklchToHex(0.25, 0.03, 165);
  return {
    fond,
    surface,
    encre: oklchToHex(0.95, 0.015, BASE_HUE),
    attenuee: readableOn(surface, BASE_HUE, 0.03, 4.5, 0.7),
    lien: readableOn(surface, 155, 0.14, 4.5, 0.75),
    bordure: readableOn(surface, BASE_HUE, 0.02, 3, 0.45),
    focus: readableOn(fond, 235, 0.12, 3, 0.7),
  };
}

interface UniverseColours {
  readonly couleur: string;
  readonly teinte: string;
  readonly texte: string;
}

function universeColours(hue: number, theme: Theme): UniverseColours {
  if (theme === "clair") {
    const teinte = oklchToHex(0.96, 0.03, hue);
    return {
      couleur: oklchToHex(0.66, 0.15, hue),
      teinte,
      texte: readableOn(teinte, hue, 0.12, 4.5, 0.6),
    };
  }
  const teinte = oklchToHex(0.3, 0.05, hue);
  return {
    couleur: oklchToHex(0.72, 0.14, hue),
    teinte,
    texte: readableOn(teinte, hue, 0.1, 4.5, 0.72),
  };
}

const pair = (
  name: string,
  foreground: string,
  background: string,
  minimum: 3 | 4.5,
): TokenPair => ({
  name,
  foreground,
  background,
  minimum,
  ratio: contrastRatio(foreground, background),
});

function pairsFor(theme: Theme): TokenPair[] {
  const c = themeColours(theme);
  const pairs = [
    pair(`${theme}:encre/fond`, c.encre, c.fond, 4.5),
    pair(`${theme}:encre/surface`, c.encre, c.surface, 4.5),
    pair(`${theme}:attenuee/fond`, c.attenuee, c.fond, 4.5),
    pair(`${theme}:attenuee/surface`, c.attenuee, c.surface, 4.5),
    pair(`${theme}:lien/fond`, c.lien, c.fond, 4.5),
    pair(`${theme}:lien/surface`, c.lien, c.surface, 4.5),
    pair(`${theme}:bordure/surface`, c.bordure, c.surface, 3),
    pair(`${theme}:focus/fond`, c.focus, c.fond, 3),
    pair(`${theme}:focus/surface`, c.focus, c.surface, 3),
  ];
  for (const [id, hue] of Object.entries(UNIVERSE_HUES)) {
    const u = universeColours(hue, theme);
    pairs.push(pair(`${theme}:univers-${id}:texte/teinte`, u.texte, u.teinte, 4.5));
  }
  return pairs;
}

export const TOKEN_PAIRS: readonly TokenPair[] = [...pairsFor("clair"), ...pairsFor("sombre")];

function themeDeclarations(theme: Theme): string[] {
  const c = themeColours(theme);
  return [
    `  color-scheme: ${theme === "clair" ? "light" : "dark"};`,
    `  --fond: ${c.fond};`,
    `  --surface: ${c.surface};`,
    `  --encre: ${c.encre};`,
    `  --encre-attenuee: ${c.attenuee};`,
    `  --lien: ${c.lien};`,
    `  --bordure: ${c.bordure};`,
    `  --focus: ${c.focus};`,
  ];
}

function universeRules(theme: Theme, prefix: string): string[] {
  return Object.entries(UNIVERSE_HUES).flatMap(([id, hue]) => {
    const u = universeColours(hue, theme);
    const facets =
      theme === "clair" ? facetShades(hue).map((hex, i) => `  --facette-${i + 1}: ${hex};`) : [];
    return [
      `${prefix}.univers-${id} {`,
      `  --couleur: ${u.couleur};`,
      `  --teinte: ${u.teinte};`,
      `  --couleur-texte: ${u.texte};`,
      ...facets,
      "}",
    ];
  });
}

const indent = (lines: readonly string[]): string[] => lines.map((line) => `  ${line}`);

export function renderTokens(): string {
  const brand = [
    `  --emeraude: ${AUBE.emeraude};`,
    `  --lagon: ${AUBE.lagon};`,
    `  --ciel: ${AUBE.ciel};`,
    `  --encre-marque: ${AUBE.encre};`,
  ];
  const darkTheme = themeDeclarations("sombre");
  const darkUniverses = (prefix: string) => universeRules("sombre", prefix);
  return [
    ":root {",
    ...brand,
    ...themeDeclarations("clair"),
    "}",
    ':root[data-theme="sombre"] {',
    ...darkTheme,
    "}",
    "@media (prefers-color-scheme: dark) {",
    '  :root:not([data-theme="clair"]) {',
    ...indent(darkTheme),
    "  }",
    "}",
    ...universeRules("clair", ""),
    ...darkUniverses(':root[data-theme="sombre"] '),
    "@media (prefers-color-scheme: dark) {",
    ...indent(darkUniverses(':root:not([data-theme="clair"]) ')),
    "}",
    "",
  ].join("\n");
}
