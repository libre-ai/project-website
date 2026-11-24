/**
 * Design tokens as CSS custom properties (ADR 0004, palette amended by ADR 0010 §1). Light is the
 * default theme; dark applies when the visitor chose it (`data-theme="sombre"`) or when the system
 * prefers it and no explicit light choice was made. Fixed colours come from palette.ts; the few
 * derived ones (link, universe text) are found by `readableOn`. Every pair a page sets text on is
 * listed in TOKEN_PAIRS so the test can hold each one to its WCAG minimum.
 */
import {
  contrastRatio,
  facetShades,
  MARTINET,
  oklchToHex,
  PAPIER_NUIT,
  ROLES,
  type Role,
  type Theme,
  UNIVERSE_HUES,
  UNIVERSE_TONES,
} from "./palette";

export type { Theme } from "./palette";

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

// The hue of the night ink (#15213b is about 265° in OKLCH): links stay in the ink's family
// instead of borrowing a role colour, which names who acts and nothing else.
const INK_HUE = 265;

interface ThemeColours {
  readonly fond: string;
  readonly surface: string;
  readonly encre: string;
  readonly attenuee: string;
  readonly lien: string;
  readonly bordure: string;
  readonly focus: string;
  readonly nuit: string;
  readonly nuitTexte: string;
  readonly nuitDoux: string;
}

function themeColours(theme: Theme): ThemeColours {
  const base = PAPIER_NUIT[theme];
  // The surface is the lighter of the two backgrounds in both themes, hence the harder one for a
  // dark link and the easier one for a light link; TOKEN_PAIRS checks the link on both anyway.
  const harder = base.surface;
  return {
    fond: base.fond,
    surface: base.surface,
    encre: base.encre,
    attenuee: base.encreAttenuee,
    lien:
      theme === "clair"
        ? readableOn(harder, INK_HUE, 0.14, 4.5, 0.55)
        : readableOn(harder, INK_HUE, 0.1, 4.5, 0.75),
    bordure: base.bordure,
    // The prototype outlines focus in the agent blue; it is held to 3:1 like any boundary.
    focus: ROLES[theme].agent.couleur,
    nuit: base.nuit,
    nuitTexte: base.nuitTexte,
    nuitDoux: base.nuitDoux,
  };
}

interface UniverseColours {
  readonly couleur: string;
  readonly teinte: string;
  readonly texte: string;
}

function universeColours(hue: number, theme: Theme): UniverseColours {
  const tones = UNIVERSE_TONES[theme];
  const teinte = oklchToHex(tones.teinte.lightness, tones.teinte.chroma, hue);
  return {
    couleur: oklchToHex(tones.couleur.lightness, tones.couleur.chroma, hue),
    teinte,
    texte:
      theme === "clair"
        ? readableOn(teinte, hue, 0.12, 4.5, 0.6)
        : readableOn(teinte, hue, 0.1, 4.5, 0.72),
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

const ROLE_NAMES = Object.keys(ROLES.clair) as Role[];

function pairsFor(theme: Theme): TokenPair[] {
  const c = themeColours(theme);
  const pairs = [
    pair(`${theme}:encre/fond`, c.encre, c.fond, 4.5),
    pair(`${theme}:encre/surface`, c.encre, c.surface, 4.5),
    pair(`${theme}:attenuee/fond`, c.attenuee, c.fond, 4.5),
    pair(`${theme}:attenuee/surface`, c.attenuee, c.surface, 4.5),
    pair(`${theme}:lien/fond`, c.lien, c.fond, 4.5),
    pair(`${theme}:lien/surface`, c.lien, c.surface, 4.5),
    pair(`${theme}:bordure/fond`, c.bordure, c.fond, 3),
    pair(`${theme}:bordure/surface`, c.bordure, c.surface, 3),
    pair(`${theme}:focus/fond`, c.focus, c.fond, 3),
    pair(`${theme}:focus/surface`, c.focus, c.surface, 3),
    pair(`${theme}:nuit-texte/nuit`, c.nuitTexte, c.nuit, 4.5),
    pair(`${theme}:nuit-doux/nuit`, c.nuitDoux, c.nuit, 4.5),
  ];
  for (const role of ROLE_NAMES) {
    const r = ROLES[theme][role];
    pairs.push(
      pair(`${theme}:${role}/fond`, r.couleur, c.fond, 4.5),
      pair(`${theme}:${role}/surface`, r.couleur, c.surface, 4.5),
      pair(`${theme}:${role}/${role}-fond`, r.couleur, r.fond, 4.5),
      pair(`${theme}:encre/${role}-fond`, c.encre, r.fond, 4.5),
    );
  }
  for (const [id, hue] of Object.entries(UNIVERSE_HUES)) {
    const u = universeColours(hue, theme);
    pairs.push(pair(`${theme}:univers-${id}:texte/teinte`, u.texte, u.teinte, 4.5));
  }
  return pairs;
}

export const TOKEN_PAIRS: readonly TokenPair[] = [...pairsFor("clair"), ...pairsFor("sombre")];

function themeDeclarations(theme: Theme): string[] {
  const c = themeColours(theme);
  const roles = ROLE_NAMES.flatMap((role) => [
    `  --${role}: ${ROLES[theme][role].couleur};`,
    `  --${role}-fond: ${ROLES[theme][role].fond};`,
  ]);
  return [
    `  color-scheme: ${theme === "clair" ? "light" : "dark"};`,
    `  --fond: ${c.fond};`,
    `  --surface: ${c.surface};`,
    `  --encre: ${c.encre};`,
    `  --encre-attenuee: ${c.attenuee};`,
    `  --lien: ${c.lien};`,
    `  --bordure: ${c.bordure};`,
    `  --focus: ${c.focus};`,
    `  --nuit: ${c.nuit};`,
    `  --nuit-texte: ${c.nuitTexte};`,
    `  --nuit-doux: ${c.nuitDoux};`,
    ...roles,
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
  // The martinet's colours do not follow the theme: the sprite draws the bird the same way on
  // paper and on night (ADR 0004 §6).
  const martinet = [
    `  --encre-marque: ${MARTINET.encre};`,
    `  --martinet-queue: ${MARTINET.queue};`,
    `  --martinet-tete: ${MARTINET.tete};`,
  ];
  const darkTheme = themeDeclarations("sombre");
  const darkUniverses = (prefix: string) => universeRules("sombre", prefix);
  return [
    ":root {",
    ...martinet,
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
