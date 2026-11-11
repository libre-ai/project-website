/**
 * Aube palette (ADR 0004). Universe colours share one lightness and one chroma in OKLCH so no
 * universe reads louder than another; only the hue differs. Contrast is computed, never asserted:
 * tokens.ts declares every text/background pair and its test holds each one to its WCAG minimum.
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

/** The arbitrated base colours (ADR 0004 §2); `lagon` is the midpoint of the Aube gradient. */
export const AUBE = {
  fond: "#f4f8f6",
  surface: "#ffffff",
  encre: "#0a2a1e",
  emeraude: "#0ba360",
  lagon: "#19b0a0",
  ciel: "#3cb9e8",
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
