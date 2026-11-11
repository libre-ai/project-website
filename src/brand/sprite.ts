/**
 * The site's one SVG sprite (ADR 0004 §6): the martinet and one emblem per application, each a
 * `<symbol>` referenced by `<use>`, so a page carries references and never copies a drawing.
 * An emblem is an origami object with the application's bird standing on it. Facet colours are
 * CSS variables resolved where the symbol is used (the universe class of the page).
 * Licence: LicenseRef-Libre-AI-Brand-1.0 (all rights reserved, owner decision of 2026-11-11);
 * unpublished candidate until the brand controls of TRADEMARKS.md are complete.
 */
import { escapeHtml } from "../security";
import { birdFacets, type Facet, type Point, speciesOf } from "./birds";
import { MARTINET_PATHS, MARTINET_TRANSFORM, MARTINET_VIEWBOX } from "./martinet-paths";
import { objectFacets, objectOf, PERCH_SEGMENT, type Tone } from "./objects";
import type { Species } from "./species";

export const SPRITE_PATH = "assets/volee.svg";
export const SPRITE_BUDGET_BYTES = 80 * 1024;

export const EMBLEM_REFS: readonly string[] = Array.from(
  { length: 40 },
  (_, i) => `p${String(i + 1).padStart(2, "0")}`,
);

// Output coordinates are integers in a 200 × 200 box: half a unit of the 100 drawing box, enough
// at every displayed size, and about half the bytes of one-decimal coordinates.
const SCALE = 2;
const BOX = 100 * SCALE;
// The bird fits inside this area, centred, its lowest point just below the perch line so it
// stands on the object rather than floating above it.
const BIRD_WIDTH = 70;
const BIRD_HEIGHT = 62;
// A bird with legs stands on the perch line; a bird without legs sits on the object, its body
// overlapping the top edge, so it never appears to float above it (owner review, 2026-11-11).
const STANDING_FOOT = PERCH_SEGMENT.y + 2;
const SITTING_FOOT = PERCH_SEGMENT.y + 8;

const toneFill = (tone: Tone): string =>
  tone === "encre" ? "var(--encre-marque)" : `var(--facette-${tone})`;

function fitBird(facets: readonly Facet[], species: Species): Facet[] {
  const xs = facets.flatMap((facet) => facet.points.map(([x]) => x));
  const ys = facets.flatMap((facet) => facet.points.map(([, y]) => y));
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const width = Math.max(...xs) - minX;
  const height = maxY - Math.min(...ys);
  const scale = Math.min(BIRD_WIDTH / width, BIRD_HEIGHT / height) * (species.emblemScale ?? 1);
  const offsetX = 50 - (width * scale) / 2;
  const foot = species.legs > 0 ? STANDING_FOOT : SITTING_FOOT;
  return facets.map((facet) => ({
    fill: facet.fill,
    points: facet.points.map(
      ([x, y]): Point => [(x - minX) * scale + offsetX, (y - maxY) * scale + foot],
    ),
  }));
}

const coordinate = (value: number): string => String(Math.round(value * SCALE));

/** Consecutive facets of one colour become one path: the painting order is unchanged. */
export function facetPaths(facets: readonly Facet[]): string {
  const runs: { fill: string; data: string[] }[] = [];
  for (const facet of facets) {
    const data = `M${facet.points.map(([x, y]) => `${coordinate(x)} ${coordinate(y)}`).join("L")}Z`;
    const last = runs.at(-1);
    if (last !== undefined && last.fill === facet.fill) last.data.push(data);
    else runs.push({ fill: facet.fill, data: [data] });
  }
  return runs.map((run) => `<path fill="${run.fill}" d="${run.data.join("")}"/>`).join("");
}

/** The facets of one emblem in the 100 × 100 drawing box: the object, then the bird on it. */
export function emblemFacets(ref: string): readonly Facet[] {
  const upper = ref.toUpperCase();
  const object = objectFacets(objectOf(upper)).map(
    (facet): Facet => ({ fill: toneFill(facet.tone), points: facet.points }),
  );
  return [...object, ...fitBird(birdFacets(upper), speciesOf(upper))];
}

export const EMBLEM_BOX = BOX;
export const EMBLEM_VIEWBOX = `0 0 ${BOX} ${BOX}`;

function emblemSymbol(ref: string): string {
  return `<symbol id="embleme-${ref}" viewBox="${EMBLEM_VIEWBOX}">${facetPaths(emblemFacets(ref))}</symbol>`;
}

function martinetSymbol(): string {
  return [
    `<symbol id="martinet" viewBox="${MARTINET_VIEWBOX}">`,
    `<g transform="${MARTINET_TRANSFORM}">`,
    `<path fill="url(#aube-degrade)" d="${MARTINET_PATHS.body}"/>`,
    `<path fill="var(--encre)" d="${MARTINET_PATHS.wing}"/>`,
    "</g></symbol>",
  ].join("");
}

// The gradient runs from emerald at the tail to sky at the head, in the y-up martinet box.
const GRADIENT =
  '<defs><linearGradient id="aube-degrade" x1="0" y1="1" x2="1" y2="0">' +
  '<stop offset="0" stop-color="#0ba360"/><stop offset=".55" stop-color="#19b0a0"/>' +
  '<stop offset="1" stop-color="#3cb9e8"/></linearGradient></defs>';

export function renderSprite(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg">',
    GRADIENT,
    martinetSymbol(),
    ...EMBLEM_REFS.map(emblemSymbol),
    "</svg>",
    "",
  ].join("\n");
}

export const FAVICON_PATH = "assets/martinet.svg";

/** The martinet as a standalone favicon: a `<use>` into the sprite cannot serve as an icon. */
export function renderFavicon(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARTINET_VIEWBOX}">`,
    GRADIENT,
    `<g transform="${MARTINET_TRANSFORM}">`,
    `<path fill="url(#aube-degrade)" d="${MARTINET_PATHS.body}"/>`,
    `<path fill="#0a2a1e" d="${MARTINET_PATHS.wing}"/>`,
    "</g></svg>",
    "",
  ].join("\n");
}

const hrefTo = (id: string): string => `/${SPRITE_PATH}#${id}`;

export function martinetUse(label: string | null): string {
  const accessibility =
    label === null ? 'aria-hidden="true"' : `role="img" aria-label="${escapeHtml(label)}"`;
  return `<svg class="martinet" viewBox="${MARTINET_VIEWBOX}" ${accessibility}><use href="${hrefTo("martinet")}"/></svg>`;
}

export function emblemUse(ref: string): string {
  const id = ref.toLowerCase();
  if (!EMBLEM_REFS.includes(id)) throw new Error(`sprite.emblem_unknown:${ref}`);
  return `<svg class="embleme" viewBox="0 0 ${BOX} ${BOX}" aria-hidden="true"><use href="${hrefTo(`embleme-${id}`)}"/></svg>`;
}
