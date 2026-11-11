/**
 * Parametric origami birds (ADR 0004 §5), ported from the v4 prototype accepted on 2026-11-09.
 * One faceted model draws every species so the 40 birds read as one family. Facet tones are CSS
 * variables set by the universe class of the page (`--facette-1` lit … `--facette-5` shadowed);
 * only a species' own accent, a pale belly and the eye keep fixed colours.
 * Licence: LicenseRef-Libre-AI-Brand-1.0 (all rights reserved, owner decision of 2026-11-11);
 * unpublished candidate until the brand controls of TRADEMARKS.md are complete.
 */
import { facetShades } from "../design/palette";
import { SPECIES, type Species } from "./species";

export type Point = readonly [number, number];

export interface Facet {
  readonly points: readonly Point[];
  readonly fill: string;
}

const INK = "var(--encre-marque)";
const BELLY = "#f6faf8";
const EYE_WHITE = "#ffffff";

const tone = (index: number): string => `var(--facette-${Math.max(0, Math.min(4, index)) + 1})`;
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const polar = (cx: number, cy: number, radius: number, degrees: number): Point => [
  cx + radius * Math.cos((degrees * Math.PI) / 180),
  cy - radius * Math.sin((degrees * Math.PI) / 180),
];

export function speciesOf(ref: string): Species {
  const species = SPECIES[ref];
  if (species === undefined) throw new Error(`birds.species_unknown:${ref}`);
  return species;
}

function tailFacets(
  sp: Species,
  P0: Point,
  P6: Point,
  shape: (points: Point[], fill: string) => void,
): void {
  const tl = sp.tailLen;
  switch (sp.tail) {
    case "fork":
      shape([P0, P6, [P0[0] - tl, P0[1] + tl * 0.45]], tone(3));
      shape([P0, P6, [P0[0] - tl * 0.6, P0[1] + tl * 0.05]], tone(2));
      shape(
        [P0, [P0[0] - tl * 0.6, P0[1] + tl * 0.05], [P0[0] - tl * 1.05, P0[1] - tl * 0.2]],
        tone(1),
      );
      return;
    case "fan":
      for (let i = 0; i < 4; i += 1) {
        const a1 = 160 + i * 14;
        shape(
          [P0, polar(P0[0], P0[1], tl, a1), polar(P0[0], P0[1], tl * 0.92, a1 + 14)],
          tone(1 + (i % 3)),
        );
      }
      return;
    case "long":
      shape([P0, P6, [P0[0] - tl, P0[1] + tl * 0.18]], tone(3));
      shape([P0, [P0[0] - tl, P0[1] + tl * 0.18], [P0[0] - tl * 0.9, P0[1] + tl * 0.02]], tone(1));
      return;
    case "short":
      shape([P0, P6, [P0[0] - tl, P0[1] + tl * 0.5]], tone(3));
      return;
    case "wedge":
      shape([P0, P6, [P0[0] - tl, P0[1] + tl * 0.35]], tone(3));
      shape([P0, [P0[0] - tl, P0[1] + tl * 0.35], [P0[0] - tl * 0.95, P0[1] - tl * 0.05]], tone(2));
      return;
    case "peacock": {
      const origin: Point = [P0[0] + 4, P0[1]];
      for (let i = 0; i < 9; i += 1) {
        const a1 = 95 + i * 13;
        shape(
          [
            origin,
            polar(origin[0], origin[1], tl, a1),
            polar(origin[0], origin[1], tl * 0.95, a1 + 13),
          ],
          tone([0, 1, 2, 1][i % 4] ?? 1),
        );
        const eye = polar(origin[0], origin[1], tl * 0.82, a1 + 6.5);
        shape(
          [add(eye, [-1.6, 0]), add(eye, [0, -1.6]), add(eye, [1.6, 0]), add(eye, [0, 1.6])],
          INK,
        );
      }
      return;
    }
    case "lyre":
      for (const [dy, side] of [
        [-1, 0],
        [1, 1],
      ] as const) {
        const tip: Point = [P0[0] - tl * 0.55, P0[1] - tl * 0.7 * (side === 0 ? 1 : 0.35)];
        const curl: Point = [tip[0] - tl * 0.22, tip[1] + tl * 0.25 * dy * -1];
        shape([P0, tip, curl, [P0[0] - tl * 0.1, P0[1] + 3]], tone(side === 0 ? 1 : 3));
      }
      shape([P0, P6, [P0[0] - tl * 0.7, P0[1] - tl * 0.15]], tone(2));
      return;
  }
}

/** The facets of one species, rotated by its tilt, in unscaled drawing coordinates. */
export function birdFacets(ref: string): readonly Facet[] {
  const sp = speciesOf(ref);
  const accent = sp.accent === undefined ? null : facetShades(sp.accent);
  const accentAt = (index: number): string => accent?.[index] ?? tone(index);
  const back: Facet[] = [];
  const front: Facet[] = [];
  const behind = (points: Point[], fill: string): void => {
    back.push({ points, fill });
  };
  const ahead = (points: Point[], fill: string): void => {
    front.push({ points, fill });
  };

  const cx = 50;
  const cy = 50;
  const { len, h } = sp;
  const P0: Point = [cx - len * 0.5, cy - h * 0.05];
  const P1: Point = [cx - len * 0.15, cy - h * 0.5];
  const P2: Point = [cx + len * 0.22, cy - h * 0.48];
  const P3: Point = [cx + len * 0.42, cy - h * 0.25];
  const P4: Point = [cx + len * 0.45, cy + h * 0.12];
  const P5: Point = [cx + len * 0.1, cy + h * 0.5];
  const P6: Point = [cx - len * 0.3, cy + h * 0.3];
  const C: Point = [cx + len * 0.02, cy];
  const hull = [P0, P1, P2, P3, P4, P5, P6];
  const bodyTones = [1, 0, 1, 2, 2, 3, 2];
  const belly = sp.pied ? BELLY : null;

  tailFacets(sp, P0, P6, behind);

  if (sp.wing === "up")
    behind([P1, [cx - len * 0.05, cy - h * 1.55], [cx + len * 0.12, cy - h * 0.6]], tone(3));

  if (sp.legs > 0) {
    const legX = cx + len * 0.05;
    const top = cy + h * 0.42;
    const ink = tone(4);
    behind(
      [
        [legX - 1, top],
        [legX + 0.6, top],
        [legX + 0.6, top + sp.legs],
        [legX - 1, top + sp.legs],
      ],
      ink,
    );
    behind(
      [
        [legX + 0.6, top + sp.legs - 1.2],
        [legX + 6, top + sp.legs - 0.4],
        [legX + 0.6, top + sp.legs + 0.6],
      ],
      ink,
    );
    if (sp.legs > 15) {
      const x2 = legX - 5;
      behind(
        [
          [x2 - 0.8, top],
          [x2 + 0.8, top],
          [x2 + 2, top + sp.legs * 0.55],
          [x2 - 4, top + sp.legs * 0.6],
          [x2 - 4, top + sp.legs * 0.6 - 1.4],
          [x2 + 0.4, top + sp.legs * 0.5],
        ],
        ink,
      );
    }
  }

  hull.forEach((p, i) => {
    const q = hull[(i + 1) % hull.length] ?? P0;
    ahead([C, p, q], i >= 4 && belly !== null ? belly : tone(bodyTones[i] ?? 2));
  });
  if (accent !== null && sp.pied === undefined && sp.beak !== "big")
    ahead([C, P3, P4], accentAt(1));

  const hs = sp.head;
  const H: Point = polar(P3[0] - hs * 0.15, P3[1] + hs * 0.1, sp.neck + hs * 0.55, sp.neckAngle);
  if (sp.neck > 2) {
    ahead([P2, P3, add(H, [hs * 0.3, hs * 0.6]), add(H, [-hs * 0.7, hs * 0.2])], tone(1));
    ahead([P3, P4, add(H, [hs * 0.3, hs * 0.6])], belly ?? tone(2));
  }
  const Ht = add(H, [-hs * 0.1, -hs]);
  const Hf = add(H, [hs * 0.9, -hs * 0.1]);
  const Hb = add(H, [hs * 0.2, hs * 0.85]);
  const Hk = add(H, [-hs, hs * 0.1]);

  switch (sp.crest) {
    case "tufts":
      behind(
        [
          add(Ht, [-hs * 0.5, hs * 0.2]),
          add(Ht, [-hs * 0.4, -hs * 0.7]),
          add(Ht, [hs * 0.1, hs * 0.1]),
        ],
        tone(3),
      );
      break;
    case "crest":
      for (let i = 0; i < 3; i += 1) {
        behind(
          [
            add(Ht, [-hs * 0.2 * i, hs * 0.3]),
            add(Ht, [-hs * (0.5 + i * 0.35), -hs * (1.1 - i * 0.2)]),
            add(Ht, [-hs * (0.1 + i * 0.3), hs * 0.5]),
          ],
          accent === null ? tone(i) : accentAt(i % 3),
        );
      }
      break;
    case "hoopoe":
      for (let i = 0; i < 5; i += 1) {
        const tip = polar(Ht[0] - hs * 0.2, Ht[1] + hs * 0.2, hs * 1.3, 70 + i * 22);
        behind(
          [add(Ht, [-hs * 0.1 * i, hs * 0.25]), tip, add(Ht, [-hs * (0.1 * i + 0.3), hs * 0.4])],
          tone(1),
        );
        behind([tip, add(tip, [1.4, 1.4]), add(tip, [-1.4, 1.4])], INK);
      }
      break;
    case "comb":
      for (let i = 0; i < 3; i += 1) {
        behind(
          [
            add(Ht, [-hs * 0.3 * i, hs * 0.2]),
            add(Ht, [-hs * (0.15 + 0.3 * i), -hs * 0.55]),
            add(Ht, [-hs * (0.3 + 0.3 * i), hs * 0.25]),
          ],
          accent === null ? tone(0) : accentAt(2),
        );
      }
      break;
    case "plume":
      for (let i = 0; i < 3; i += 1) {
        const tip = polar(Ht[0], Ht[1], hs * 1.3, 95 + i * 18);
        behind([Ht, tip, add(Ht, [-0.8, 0.8])], tone(4));
        behind(
          [add(tip, [-1.3, 0]), add(tip, [0, -1.3]), add(tip, [1.3, 0]), add(tip, [0, 1.3])],
          tone(2),
        );
      }
      break;
    case "none":
    case "cap":
      break;
  }

  ahead([H, Ht, Hf], tone(0));
  ahead([H, Hf, Hb], belly ?? tone(2));
  ahead([H, Hb, Hk], tone(3));
  ahead([H, Hk, Ht], tone(1));
  if (sp.crest === "cap")
    ahead([Hk, Ht, add(Ht, [hs * 0.6, hs * 0.15]), H], accent === null ? tone(4) : accentAt(2));

  const bl = sp.beakLen;
  const B0 = add(Hf, [-hs * 0.15, -hs * 0.18]);
  const B1 = add(Hf, [-hs * 0.15, hs * 0.32]);
  const beakTone =
    accent !== null && (sp.beak === "big" || sp.beak === "long") ? accentAt(2) : tone(4);
  switch (sp.beak) {
    case "short":
      ahead([B0, [Hf[0] + bl, Hf[1] + hs * 0.08], B1], beakTone);
      break;
    case "hook":
      ahead(
        [B0, [Hf[0] + bl * 0.9, Hf[1] - hs * 0.05], [Hf[0] + bl * 0.8, Hf[1] + hs * 0.55], B1],
        beakTone,
      );
      ahead(
        [B0, [Hf[0] + bl * 0.9, Hf[1] - hs * 0.05], [Hf[0] + bl * 0.4, Hf[1] + hs * 0.1]],
        tone(3),
      );
      break;
    case "long":
      ahead([B0, [Hf[0] + bl, Hf[1] + hs * 0.12], B1], beakTone);
      ahead([B0, [Hf[0] + bl, Hf[1] + hs * 0.12], [Hf[0], Hf[1] + hs * 0.06]], tone(3));
      break;
    case "down":
      ahead(
        [
          B0,
          [Hf[0] + bl * 0.55, Hf[1] + hs * 0.15],
          [Hf[0] + bl, Hf[1] + hs * 0.95],
          [Hf[0] + bl * 0.5, Hf[1] + hs * 0.45],
          B1,
        ],
        beakTone,
      );
      break;
    case "big": {
      const top = add(Hf, [-hs * 0.15, -hs * 0.65]);
      const bottom = add(Hf, [-hs * 0.15, hs * 0.6]);
      const tip: Point = [Hf[0] + bl, Hf[1] + hs * 0.25];
      ahead([top, tip, [Hf[0], Hf[1] + hs * 0.05]], accent === null ? tone(1) : accentAt(1));
      ahead([[Hf[0], Hf[1] + hs * 0.05], tip, bottom], accent === null ? tone(3) : accentAt(3));
      ahead([add(tip, [-bl * 0.25, -hs * 0.05]), tip, add(tip, [-bl * 0.2, hs * 0.2])], INK);
      break;
    }
    case "flat":
      ahead(
        [B0, [Hf[0] + bl, Hf[1] + hs * 0.05], [Hf[0] + bl, Hf[1] + hs * 0.35], B1],
        accent === null ? tone(4) : accentAt(2),
      );
      break;
    case "pouch":
      ahead(
        [B0, [Hf[0] + bl, Hf[1] + hs * 0.15], [Hf[0] + bl * 0.95, Hf[1] + hs * 0.35], B1],
        tone(4),
      );
      ahead(
        [B1, [Hf[0] + bl * 0.92, Hf[1] + hs * 0.35], [Hf[0] + bl * 0.35, Hf[1] + hs * 1.5]],
        tone(1),
      );
      break;
    case "open":
      ahead([B0, [Hf[0] + bl, Hf[1] - hs * 0.35], [Hf[0], Hf[1] + hs * 0.05]], beakTone);
      ahead([[Hf[0], Hf[1] + hs * 0.15], [Hf[0] + bl * 0.9, Hf[1] + hs * 0.5], B1], beakTone);
      break;
  }

  // The eye is a pixel, like the trailing pixels of the martinet.
  const e = sp.bigEye ? hs * 0.42 : hs * 0.24;
  const E = add(H, [hs * 0.22, -hs * 0.32]);
  const square = (centre: Point, half: number): Point[] => [
    add(centre, [-half, -half]),
    add(centre, [half, -half]),
    add(centre, [half, half]),
    add(centre, [-half, half]),
  ];
  if (sp.bigEye) {
    ahead(square(E, e), EYE_WHITE);
    ahead(square(E, e * 0.45), INK);
  } else {
    ahead(square(E, e / 2), INK);
  }

  switch (sp.wing) {
    case "up":
      ahead([P2, P1, [cx - len * 0.2, cy - h * 1.75]], tone(1));
      ahead([P2, [cx - len * 0.2, cy - h * 1.75], [cx + len * 0.18, cy - h * 1.45]], tone(0));
      ahead([P1, [cx - len * 0.2, cy - h * 1.75], [cx - len * 0.42, cy - h * 1.2]], tone(2));
      break;
    case "glide":
      ahead([P2, P1, [cx - len * 0.75, cy - h * 0.95]], tone(1));
      ahead([P2, [cx - len * 0.75, cy - h * 0.95], [cx - len * 0.55, cy - h * 1.25]], tone(0));
      ahead([P1, [cx - len * 0.75, cy - h * 0.95], [cx - len * 0.3, cy - h * 0.2]], tone(3));
      break;
    case "down":
      ahead([P2, P1, [cx - len * 0.05, cy + h * 1.35]], tone(1));
      ahead([P2, [cx - len * 0.05, cy + h * 1.35], [cx + len * 0.22, cy + h * 1.05]], tone(0));
      break;
    case "folded":
      ahead([P2, P1, [cx - len * 0.58, cy + h * 0.02]], tone(2));
      ahead([P2, [cx - len * 0.58, cy + h * 0.02], [cx - len * 0.05, cy + h * 0.22]], tone(1));
      ahead(
        [
          [cx - len * 0.58, cy + h * 0.02],
          [cx - len * 0.3, cy + h * 0.16],
          [cx - len * 0.45, cy + h * 0.12],
        ],
        tone(3),
      );
      break;
  }

  // Signature pixels trailing behind, as in the martinet.
  const trail: Facet[] = [];
  const tx = P0[0] - Math.max(sp.tailLen, 8) - 4;
  const pixels: readonly (readonly [number, number, number])[] = [
    [0, -3, 2.6],
    [-4.5, 1, 2],
    [-8, -2, 1.5],
  ];
  pixels.forEach(([dx, dy, size], i) => {
    const x = tx + dx;
    const y = P0[1] + dy;
    trail.push({
      points: [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
      ],
      fill: tone(i === 0 ? 2 : 1),
    });
  });

  const angle = (sp.tilt * Math.PI) / 180;
  const rotate = (p: Point): Point => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [
      cx + dx * Math.cos(angle) - dy * Math.sin(angle),
      cy + dx * Math.sin(angle) + dy * Math.cos(angle),
    ];
  };
  return [...trail, ...back, ...front].map((facet) => ({
    fill: facet.fill,
    points: facet.points.map(rotate),
  }));
}
