/**
 * Origami objects that carry each application's bird (« l'objet porte l'oiseau », ADR 0004 §5,
 * owner decision of 2026-11-11). Every object is folded from flat facets in the lower band of a
 * 100 × 100 emblem, with its top edge on the perch line where the bird stands. Light comes from
 * the top left: tone 1 is the lit facet, tone 5 the shadowed one, `encre` the ink details.
 * Licence: LicenseRef-Libre-AI-Brand-1.0 (all rights reserved, owner decision of 2026-11-11);
 * unpublished candidate until the brand controls of TRADEMARKS.md are complete.
 */
import type { Point } from "./birds";

export type Tone = 1 | 2 | 3 | 4 | 5 | "encre";

export interface ObjectFacet {
  readonly points: readonly Point[];
  readonly tone: Tone;
}

/** The bird stands on y = 64; objects fill the band from there down to y = 96. */
export const PERCH_SEGMENT = { y: 64, bottom: 96 } as const;

export type ObjectKind =
  | "parchemin-scelle"
  | "longue-vue"
  | "pile-de-livres"
  | "carnet"
  | "classeur"
  | "loupe"
  | "fiches"
  | "document"
  | "grille"
  | "ecran-projection"
  | "dossier"
  | "liasse"
  | "urne"
  | "pense-betes"
  | "ticket"
  | "presse-papiers"
  | "enveloppe"
  | "camera"
  | "calendrier"
  | "carte-de-visite"
  | "table-ronde"
  | "clap"
  | "cubes"
  | "micro"
  | "navigateur"
  | "porte-voix"
  | "cadre-photo"
  | "metronome"
  | "televiseur"
  | "livre-ouvert"
  | "disque"
  | "de"
  | "aiguillage"
  | "bulle"
  | "engrenages"
  | "tunnel"
  | "coffre-fort"
  | "bouee"
  | "tableau-noir"
  | "fenetres";

/** The object of each application, keyed by reference like the species. */
export const OBJECT_OF: Readonly<Record<string, ObjectKind>> = {
  P01: "parchemin-scelle",
  P02: "longue-vue",
  P03: "pile-de-livres",
  P04: "carnet",
  P05: "classeur",
  P06: "loupe",
  P07: "fiches",
  P08: "document",
  P09: "grille",
  P10: "ecran-projection",
  P11: "dossier",
  P12: "liasse",
  P13: "urne",
  P14: "pense-betes",
  P15: "ticket",
  P16: "presse-papiers",
  P17: "enveloppe",
  P18: "camera",
  P19: "calendrier",
  P20: "carte-de-visite",
  P21: "table-ronde",
  P22: "clap",
  P23: "cubes",
  P24: "micro",
  P25: "navigateur",
  P26: "porte-voix",
  P27: "cadre-photo",
  P28: "metronome",
  P29: "televiseur",
  P30: "livre-ouvert",
  P31: "disque",
  P32: "de",
  P33: "aiguillage",
  P34: "bulle",
  P35: "engrenages",
  P36: "tunnel",
  P37: "coffre-fort",
  P38: "bouee",
  P39: "tableau-noir",
  P40: "fenetres",
};

const f = (tone: Tone, ...points: Point[]): ObjectFacet => ({ tone, points });
const rect = (x0: number, y0: number, x1: number, y1: number, tone: Tone): ObjectFacet =>
  f(tone, [x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/** A regular polygon, first vertex straight up so its top touches `cy - r`. */
function ring(cx: number, cy: number, r: number, sides: number, rotation = 0): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + rotation + (i * 2 * Math.PI) / sides;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  });
}

/** A cog: alternating outer and inner radius, first tooth straight up. */
function cog(cx: number, cy: number, r: number, teeth: number): Point[] {
  return Array.from({ length: teeth * 2 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / teeth;
    const radius = i % 2 === 0 ? r : r * 0.78;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  });
}

/** One segment of an annulus between two angles (radians, 0 = up, clockwise). */
function annulusSegment(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  from: number,
  to: number,
  steps = 3,
): Point[] {
  const at = (radius: number, angle: number): Point => [
    cx + radius * Math.sin(angle),
    cy - radius * Math.cos(angle),
  ];
  const outerArc = Array.from({ length: steps + 1 }, (_, i) =>
    at(outer, from + ((to - from) * i) / steps),
  );
  const innerArc = Array.from({ length: steps + 1 }, (_, i) =>
    at(inner, to - ((to - from) * i) / steps),
  );
  return [...outerArc, ...innerArc];
}

const DRAWINGS: Readonly<Record<ObjectKind, () => readonly ObjectFacet[]>> = {
  "parchemin-scelle": () => [
    rect(28, 66, 72, 92, 1),
    rect(26, 64, 74, 70, 2),
    rect(26, 88, 74, 94, 3),
    rect(32, 74, 56, 76, 4),
    rect(32, 80, 52, 82, 4),
    f(5, [60, 78], [66, 84], [60, 90], [54, 84]),
  ],
  "longue-vue": () => [
    f(4, [46, 78], [49, 78], [40, 96], [37, 96]),
    f(3, [49, 78], [52, 78], [60, 96], [57, 96]),
    f(2, [24, 74], [70, 64], [74, 72], [28, 82]),
    f(1, [64, 65.3], [70, 64], [74, 72], [68, 73.3]),
    f(4, [20, 76], [26, 74.7], [28, 82], [22, 83.3]),
  ],
  "pile-de-livres": () => [
    rect(24, 86, 76, 96, 2),
    rect(24, 86, 30, 96, 4),
    rect(28, 75, 70, 86, 3),
    rect(64, 75, 70, 86, 5),
    rect(32, 64, 68, 75, 1),
    rect(32, 64, 37, 75, 4),
  ],
  carnet: () => [
    rect(30, 64, 70, 96, 2),
    rect(66, 66, 70, 94, 1),
    ...[68, 74, 80, 86, 92].map((y) => rect(28, y - 1, 34, y + 1, "encre")),
  ],
  classeur: () => [
    rect(26, 66, 30, 96, 4),
    rect(30, 64, 68, 96, 2),
    rect(38, 70, 60, 78, 1),
    f("encre", [49, 86], [52, 89], [49, 92], [46, 89]),
  ],
  loupe: () => [
    f(5, [52, 84], [56, 80], [74, 96], [68, 96]),
    f(4, ...ring(44, 76, 12, 8)),
    f(1, ...ring(44, 76, 9, 8)),
    f(2, [38, 72], [44, 70], [40, 78]),
  ],
  fiches: () => [
    f(3, [30, 70], [66, 64], [72, 88], [36, 94]),
    rect(26, 72, 70, 96, 1),
    rect(32, 80, 60, 82, 4),
    rect(32, 86, 52, 88, 4),
  ],
  document: () => [
    f(1, [30, 64], [62, 64], [70, 72], [70, 96], [30, 96]),
    f(3, [62, 64], [62, 72], [70, 72]),
    rect(36, 76, 62, 78, 4),
    rect(36, 82, 64, 84, 4),
    rect(36, 88, 56, 90, 4),
  ],
  grille: () => [
    rect(24, 64, 76, 96, 1),
    rect(24, 64, 76, 71, 3),
    rect(24, 71, 32, 96, 2),
    rect(48, 71, 49, 96, 4),
    rect(62, 71, 63, 96, 4),
    rect(32, 79, 76, 80, 4),
    rect(32, 87, 76, 88, 4),
  ],
  "ecran-projection": () => [
    f(4, [48, 86], [52, 86], [54, 96], [46, 96]),
    rect(24, 66, 76, 86, 1),
    rect(22, 64, 78, 67, 4),
    rect(32, 76, 38, 83, 3),
    rect(42, 72, 48, 83, 2),
    rect(52, 74, 58, 83, 3),
    rect(62, 70, 68, 83, 2),
  ],
  dossier: () => [
    f(3, [24, 64], [44, 64], [48, 68], [76, 68], [76, 96], [24, 96]),
    rect(30, 70, 70, 76, 1),
    f(2, [24, 74], [76, 74], [72, 96], [28, 96]),
  ],
  liasse: () => [
    f(3, [34, 64], [74, 66], [72, 96], [32, 94]),
    rect(28, 67, 68, 96, 2),
    rect(24, 70, 64, 96, 1),
    rect(28, 73, 36, 75, "encre"),
    rect(30, 80, 58, 82, 4),
    rect(30, 86, 54, 88, 4),
  ],
  urne: () => [
    f(4, [70, 72], [78, 66], [78, 90], [70, 96]),
    rect(30, 72, 70, 96, 2),
    f(1, [30, 72], [38, 66], [78, 66], [70, 72]),
    rect(44, 68, 62, 69.5, "encre"),
    f(1, [47, 64], [57, 64], [56, 68.5], [48, 68.5]),
  ],
  "pense-betes": () => [
    f(3, [28, 64], [44, 66], [42, 80], [26, 78]),
    rect(48, 70, 62, 84, 2),
    f(4, [64, 68], [76, 70], [74, 84], [62, 82]),
    rect(34, 82, 48, 94, 2),
    rect(43, 74, 49, 75, "encre"),
  ],
  ticket: () => [
    f(2, [22, 70], [76, 64], [79, 90], [25, 96]),
    f(1, [58, 66.2], [60, 66], [63, 92.4], [61, 92.6]),
    f(4, [22, 80], [26, 82], [23, 85]),
    f(4, [77.5, 76], [74, 78.5], [78, 81]),
    f(3, [30, 76], [52, 73.6], [52.3, 76], [30.3, 78.4]),
    f(3, [31, 84], [48, 82.2], [48.3, 84.4], [31.3, 86.2]),
  ],
  "presse-papiers": () => [
    rect(28, 66, 72, 96, 4),
    rect(32, 70, 68, 94, 1),
    rect(42, 64, 58, 70, 5),
    rect(36, 76, 40, 80, 3),
    rect(36, 84, 40, 88, 3),
    rect(44, 77, 62, 79, 4),
    rect(44, 85, 58, 87, 4),
    f("encre", [36.5, 77.5], [38, 79], [41, 75], [41.5, 75.5], [38, 80.5], [36, 78]),
  ],
  enveloppe: () => [
    rect(22, 64, 78, 92, 2),
    f(3, [22, 92], [50, 76], [78, 92]),
    f(1, [22, 64], [50, 80], [78, 64]),
  ],
  camera: () => [
    rect(30, 64, 46, 70, 4),
    rect(24, 70, 62, 92, 2),
    f(3, [62, 76], [78, 68], [78, 94], [62, 86]),
    rect(28, 74, 32, 78, 5),
    rect(36, 80, 56, 88, 1),
  ],
  calendrier: () => [
    rect(26, 68, 74, 96, 1),
    rect(26, 68, 74, 76, 3),
    rect(36, 64, 39, 72, "encre"),
    rect(61, 64, 64, 72, "encre"),
    rect(32, 80, 40, 86, 2),
    rect(44, 80, 52, 86, 2),
    rect(56, 80, 64, 86, 5),
    rect(32, 88, 40, 94, 2),
    rect(44, 88, 52, 94, 2),
  ],
  "carte-de-visite": () => [
    f(3, [30, 64], [78, 70], [74, 92], [26, 86]),
    rect(22, 72, 70, 96, 1),
    f(2, [34, 78], [40, 84], [34, 90], [28, 84]),
    rect(44, 80, 64, 82, 4),
    rect(44, 86, 58, 88, 4),
  ],
  "table-ronde": () => [
    f(4, [36, 92], [64, 92], [66, 96], [34, 96]),
    rect(47, 78, 53, 92, 4),
    f(3, [22, 72], [78, 72], [76, 76], [66, 79], [50, 80], [34, 79], [24, 76]),
    f(
      1,
      [22, 72],
      [26, 68],
      [36, 65],
      [50, 64],
      [64, 65],
      [74, 68],
      [78, 72],
      [64, 75],
      [50, 76],
      [36, 75],
    ),
  ],
  clap: () => [
    rect(26, 76, 74, 96, 2),
    rect(26, 76, 74, 80, "encre"),
    f(4, [26, 72], [72, 64], [74, 70], [28, 78]),
    f(1, [36, 70.3], [44, 68.9], [46, 74.6], [38, 76]),
    f(1, [54, 67.1], [62, 65.8], [64, 71.5], [56, 72.9]),
    rect(32, 84, 60, 86, 1),
    rect(32, 90, 52, 92, 1),
  ],
  cubes: () => [
    f(1, [26, 80], [38, 76], [50, 80], [38, 84]),
    f(3, [26, 80], [38, 84], [38, 96], [26, 92]),
    f(4, [38, 84], [50, 80], [50, 92], [38, 96]),
    f(1, [50, 80], [62, 76], [74, 80], [62, 84]),
    f(3, [50, 80], [62, 84], [62, 96], [50, 92]),
    f(4, [62, 84], [74, 80], [74, 92], [62, 96]),
    f(1, [38, 68], [50, 64], [62, 68], [50, 72]),
    f(2, [38, 68], [50, 72], [50, 84], [38, 80]),
    f(4, [50, 72], [62, 68], [62, 80], [50, 84]),
  ],
  micro: () => [
    rect(48, 84, 52, 92, 4),
    rect(38, 92, 62, 96, 5),
    f(3, [42, 64], [58, 64], [62, 70], [62, 80], [58, 84], [42, 84], [38, 80], [38, 70]),
    f(1, [42, 64], [50, 64], [50, 84], [42, 84], [38, 80], [38, 70]),
    rect(38, 74, 62, 75.5, 4),
  ],
  navigateur: () => [
    rect(22, 64, 78, 96, 1),
    rect(22, 64, 78, 71, 3),
    rect(25, 66.5, 27, 68.5, "encre"),
    rect(29, 66.5, 31, 68.5, "encre"),
    rect(33, 66.5, 35, 68.5, "encre"),
    rect(28, 76, 50, 90, 2),
    rect(54, 76, 72, 80, 4),
    rect(54, 84, 68, 86, 4),
  ],
  "porte-voix": () => [
    f(4, [40, 88], [46, 88], [44, 96], [38, 96]),
    rect(24, 74, 34, 86, 3),
    f(2, [34, 72], [72, 64], [72, 96], [34, 88]),
    f(4, [66, 65.3], [72, 64], [72, 96], [66, 94.7]),
    f(1, [34, 72], [72, 64], [72, 70], [34, 76]),
  ],
  "cadre-photo": () => [
    rect(24, 64, 76, 96, 4),
    rect(29, 69, 71, 91, 1),
    f(2, [29, 91], [44, 76], [56, 88], [62, 82], [71, 91]),
    rect(60, 72, 65, 77, 5),
  ],
  metronome: () => [
    f(2, [40, 64], [60, 64], [70, 96], [30, 96]),
    f(1, [40, 64], [50, 64], [50, 96], [30, 96]),
    f("encre", [49, 92], [51, 92], [62, 70], [60, 69]),
    f(5, [57, 72], [60, 76], [57, 80], [54, 76]),
    rect(28, 92, 72, 96, 4),
  ],
  televiseur: () => [
    f(4, [44, 68], [46, 68], [38, 64], [36, 64]),
    f(4, [54, 68], [56, 68], [64, 64], [62, 64]),
    rect(30, 92, 36, 96, 4),
    rect(64, 92, 70, 96, 4),
    rect(24, 68, 76, 92, 4),
    rect(28, 72, 72, 88, 1),
    f(3, [46, 76], [56, 80], [46, 84]),
  ],
  "livre-ouvert": () => [
    f(4, [20, 92], [50, 96], [80, 92], [80, 95], [50, 99], [20, 95]),
    f(1, [22, 68], [50, 72], [50, 96], [22, 92]),
    f(2, [50, 72], [78, 68], [78, 92], [50, 96]),
    f(5, [62, 64], [66, 64], [66, 74], [64, 72], [62, 74]),
    f(4, [28, 76], [44, 78.3], [44, 79.8], [28, 77.5]),
    f(4, [28, 82], [44, 84.3], [44, 85.8], [28, 83.5]),
  ],
  disque: () => [
    f(5, ...ring(50, 80, 16, 12)),
    f(4, [50, 64], [58, 66.1], [52, 74]),
    f(2, ...ring(50, 80, 6, 8)),
    rect(49, 79, 51, 81, 1),
  ],
  de: () => [
    f(2, [36, 72], [50, 64], [50, 70]),
    f(3, [50, 64], [64, 72], [50, 70]),
    f(3, [64, 72], [60, 86], [50, 70]),
    f(4, [64, 88], [60, 86], [64, 72]),
    f(2, [36, 72], [50, 70], [40, 86]),
    f(3, [36, 88], [40, 86], [36, 72]),
    f(4, [36, 88], [50, 96], [40, 86]),
    f(4, [50, 96], [64, 88], [60, 86], [40, 86]),
    f(1, [50, 70], [60, 86], [40, 86]),
    rect(48, 78, 52, 82, "encre"),
  ],
  aiguillage: () => [
    rect(48, 64, 52, 96, 4),
    f(2, [52, 68], [72, 68], [78, 72], [72, 76], [52, 76]),
    f(1, [48, 78], [28, 78], [22, 82], [28, 86], [48, 86]),
    rect(42, 94, 58, 96, 5),
  ],
  bulle: () => [
    f(1, [24, 64], [76, 64], [76, 86], [46, 86], [36, 96], [38, 86], [24, 86]),
    rect(64, 64, 76, 86, 2),
    rect(36, 73, 40, 77, "encre"),
    rect(48, 73, 52, 77, "encre"),
    rect(60, 73, 64, 77, "encre"),
  ],
  engrenages: () => [
    f(3, ...cog(64, 72, 8, 8)),
    rect(62, 70, 66, 74, "encre"),
    f(2, ...cog(42, 82, 13, 10)),
    rect(39, 79, 45, 85, "encre"),
  ],
  // Six steps per half circle so one vertex sits at the top of each arch.
  tunnel: () => [
    f(4, ...annulusSegment(50, 96, 32, 0.01, -Math.PI / 2, Math.PI / 2, 6)),
    f(5, ...annulusSegment(50, 96, 22, 0.01, -Math.PI / 2, Math.PI / 2, 6)),
    f(1, ...annulusSegment(50, 96, 7, 0.01, -Math.PI / 2, Math.PI / 2, 6)),
    f(2, [44, 96], [56, 96], [52, 86], [48, 86]),
  ],
  "coffre-fort": () => [
    rect(26, 64, 74, 96, 4),
    rect(30, 68, 70, 92, 2),
    f(1, ...ring(50, 80, 7, 8, Math.PI / 8)),
    rect(48, 78, 52, 82, "encre"),
    rect(28, 72, 30, 76, 5),
    rect(28, 84, 30, 88, 5),
  ],
  bouee: () =>
    Array.from({ length: 8 }, (_, i) =>
      f(
        i % 2 === 0 ? 1 : 5,
        ...annulusSegment(50, 80, 16, 9, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4),
      ),
    ),
  "tableau-noir": () => [
    f(4, [30, 90], [34, 90], [30, 96], [26, 96]),
    f(4, [66, 90], [70, 90], [74, 96], [70, 96]),
    rect(22, 64, 78, 90, 4),
    rect(25, 67, 75, 87, 5),
    rect(30, 72, 54, 74, 1),
    rect(30, 78, 48, 80, 1),
  ],
  fenetres: () => [
    rect(24, 64, 48, 78, 1),
    rect(52, 64, 76, 78, 3),
    rect(24, 82, 48, 96, 3),
    rect(52, 82, 76, 96, 2),
    rect(24, 64, 48, 67, 4),
    rect(52, 64, 76, 67, 4),
    rect(24, 82, 48, 85, 4),
    rect(52, 82, 76, 85, 4),
  ],
};

export function objectFacets(kind: ObjectKind): readonly ObjectFacet[] {
  return DRAWINGS[kind]();
}

export function objectOf(ref: string): ObjectKind {
  const kind = OBJECT_OF[ref];
  if (kind === undefined) throw new Error(`objects.kind_unknown:${ref}`);
  return kind;
}
