/**
 * Paper and night palette (ADR 0010 §1, amending ADR 0004 §2). The exact values of every token,
 * light and dark, live here; tokens.ts turns them into CSS custom properties and declares each
 * text/background pair so its test holds the pair to its WCAG minimum (ADR 0004 §3, unchanged).
 * Universe colours share one lightness and one chroma in OKLCH so no universe reads louder than
 * another; only the hue differs.
 */

// Matrices from Björn Ottosson's OKLab definition (2020), OKLab → linear sRGB.
function oklabToLinearSrgb(l: number, a: number, b: number): readonly [number, number, number] {
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const L = lPrime ** 3;
  const M = mPrime ** 3;
  const S = sPrime ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

function encodeSrgb(linear: number): number {
  // Out-of-gamut values are clamped per channel: a slightly desaturated colour is preferable to
  // an invalid one, and the contrast test measures the clamped result, not the intended one.
  const clamped = Math.min(1, Math.max(0, linear));
  const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

export function oklchToHex(lightness: number, chroma: number, hueDegrees: number): string {
  const hue = (hueDegrees * Math.PI) / 180;
  const channels = oklabToLinearSrgb(lightness, chroma * Math.cos(hue), chroma * Math.sin(hue));
  return `#${channels.map((value) => encodeSrgb(value).toString(16).padStart(2, "0")).join("")}`;
}

const HEX = /^#[0-9a-f]{6}$/i;

function relativeLuminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`palette.hex_invalid:${hex}`);
  const channel = (offset: number): number => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Light is the default theme, dark its variant (ADR 0010 §1); the order is the cascade order. */
export const THEMES = ["clair", "sombre"] as const;

export type Theme = (typeof THEMES)[number];

interface BaseColours {
  /** Page background: the paper. */
  readonly fond: string;
  readonly surface: string;
  readonly encre: string;
  readonly encreAttenuee: string;
  /** Interface boundaries (WCAG 1.4.11): held to 3:1 against the surface and the paper. */
  readonly bordure: string;
  /** The night of the opening sections, and the text set on it. */
  readonly nuit: string;
  readonly nuitTexte: string;
  readonly nuitDoux: string;
}

/**
 * Light values are the ADR's; the dark ones are those of the prototype judged in version 17
 * (`tools/recap.ts` of the redesign workspace), where the paper becomes a night-blue sheet and the
 * opening a deeper night.
 */
export const PAPIER_NUIT: Readonly<Record<Theme, BaseColours>> = {
  clair: {
    fond: "#fbfaf7",
    surface: "#ffffff",
    encre: "#15213b",
    encreAttenuee: "#46536d",
    bordure: "#7a879c",
    nuit: "#15213b",
    nuitTexte: "#f4f7fa",
    nuitDoux: "#b9c4d8",
  },
  sombre: {
    fond: "#121b31",
    surface: "#162038",
    encre: "#e9eef6",
    encreAttenuee: "#aab5c9",
    bordure: "#7d8aa3",
    nuit: "#0a1020",
    nuitTexte: "#e9eef6",
    nuitDoux: "#aab5c9",
  },
};

export type Role = "personne" | "agent" | "controle" | "incident";

interface RoleColour {
  /** The role's colour, readable as text on the paper, the surface and its own tint. */
  readonly couleur: string;
  /** A pale (or, in dark, deep) tint of the role, for the background of what it marks. */
  readonly fond: string;
}

/** Who acts, from the home page down to the detail (ADR 0010 §1). */
export const ROLES: Readonly<Record<Theme, Readonly<Record<Role, RoleColour>>>> = {
  clair: {
    personne: { couleur: "#875000", fond: "#ffe4a8" },
    agent: { couleur: "#1f5bb5", fond: "#d6e4fb" },
    controle: { couleur: "#1b6e45", fond: "#d2eedd" },
    incident: { couleur: "#a8291f", fond: "#fadad5" },
  },
  sombre: {
    personne: { couleur: "#f3bf63", fond: "#3b2b0b" },
    agent: { couleur: "#8db6ff", fond: "#15294c" },
    controle: { couleur: "#73d4a3", fond: "#0f3321" },
    incident: { couleur: "#ff9184", fond: "#42140f" },
  },
};

/**
 * The martinet keeps its colours (ADR 0010 keeps the bird): the three stops of the gradient the
 * sprite draws, and the ink of the emblems' outlines and of the favicon's wing. They mark the brand
 * only and are never a text or background colour of the page. The wing of the bird drawn in the
 * page reads the page ink (`--encre`), as on the base, so it shows on paper and on night: in light
 * it moves with that ink from #0a2a1e to #15213b.
 */
export const MARTINET = {
  encre: "#0a2a1e",
  queue: "#0ba360",
  milieu: "#19b0a0",
  tete: "#3cb9e8",
} as const;

/** One hue per universe, about 45 degrees apart, keyed by the universe id of src/content. */
export const UNIVERSE_HUES = {
  "creer-publier": 25,
  "travailler-ensemble": 70,
  apprendre: 110,
  "s-informer": 155,
  "se-proteger": 195,
  "ecrire-calculer": 240,
  "piloter-ia": 285,
  "se-divertir": 330,
} as const satisfies Readonly<Record<string, number>>;

export type UniverseHueId = keyof typeof UNIVERSE_HUES;

interface OklchTone {
  readonly lightness: number;
  readonly chroma: number;
}

/**
 * Common lightness and chroma of the universe colour and of its tint, per theme. Each chroma is the
 * largest one that keeps all eight hues inside sRGB at that lightness: above it, clamping would
 * desaturate some hues (cyan first) and break the common chroma the ADR requires.
 */
export const UNIVERSE_TONES: Readonly<
  Record<Theme, { readonly couleur: OklchTone; readonly teinte: OklchTone }>
> = {
  clair: { couleur: { lightness: 0.66, chroma: 0.11 }, teinte: { lightness: 0.96, chroma: 0.018 } },
  sombre: { couleur: { lightness: 0.72, chroma: 0.12 }, teinte: { lightness: 0.3, chroma: 0.05 } },
};

/** Five facet tones for origami drawings, from the lit facet to the shadowed one. */
export function facetShades(hue: number): readonly string[] {
  const steps: readonly (readonly [number, number])[] = [
    [0.92, 0.06],
    [0.82, 0.11],
    [0.72, 0.14],
    [0.6, 0.13],
    [0.47, 0.1],
  ];
  return steps.map(([lightness, chroma]) => oklchToHex(lightness, chroma, hue));
}
