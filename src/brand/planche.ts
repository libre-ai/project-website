/**
 * Review sheet of the 40 emblems (plan, Task 5b), for the owner's visual acceptance. It is a
 * standalone SVG with every colour resolved, so any SVG renderer shows it without CSS; it is
 * never part of the published site. Usage: `bun src/brand/planche.ts <output.svg>`.
 * Licence: LicenseRef-Libre-AI-Brand-1.0 (all rights reserved, owner decision of 2026-11-11);
 * unpublished candidate until the brand controls of TRADEMARKS.md are complete.
 */

import { UNIVERSE_OF, UNIVERSES } from "../content/universes";
import { AUBE, facetShades, UNIVERSE_HUES } from "../design/palette";
import { escapeHtml } from "../security";
import { speciesOf } from "./birds";
import { objectOf } from "./objects";
import { EMBLEM_BOX, emblemFacets, facetPaths } from "./sprite";

const CELL_WIDTH = 150;
const CELL_HEIGHT = 182;
const EMBLEM_SIZE = 120;
const COLUMNS = 8;
const HEADER = 40;

function resolve(fill: string, hue: number): string {
  const facet = /^var\(--facette-([1-5])\)$/.exec(fill);
  if (facet !== null) return facetShades(hue)[Number(facet[1]) - 1] ?? fill;
  if (fill === "var(--encre-marque)") return AUBE.encre;
  return fill;
}

export function renderPlanche(): string {
  const refs = UNIVERSES.flatMap((universe) =>
    Object.keys(UNIVERSE_OF)
      .filter((ref) => UNIVERSE_OF[ref] === universe.id)
      .sort(),
  );
  const rows = Math.ceil(refs.length / COLUMNS);
  const width = COLUMNS * CELL_WIDTH;
  const height = HEADER + rows * CELL_HEIGHT;
  const cells = refs.map((ref, index) => {
    const universe = UNIVERSE_OF[ref];
    const hue = universe === undefined ? 155 : UNIVERSE_HUES[universe];
    const facets = emblemFacets(ref).map((facet) => ({ ...facet, fill: resolve(facet.fill, hue) }));
    const x = (index % COLUMNS) * CELL_WIDTH;
    const y = HEADER + Math.floor(index / COLUMNS) * CELL_HEIGHT;
    const offset = (CELL_WIDTH - EMBLEM_SIZE) / 2;
    const label = `${ref} · ${speciesOf(ref).name}`;
    return [
      `<rect x="${x + 4}" y="${y + 4}" width="${CELL_WIDTH - 8}" height="${CELL_HEIGHT - 8}" rx="10" fill="#ffffff"/>`,
      // A transformed group rather than a nested <svg>: some renderers ignore nested positions.
      `<g transform="translate(${x + offset},${y + 8}) scale(${EMBLEM_SIZE / EMBLEM_BOX})">${facetPaths(facets)}</g>`,
      `<text x="${x + CELL_WIDTH / 2}" y="${y + 146}" text-anchor="middle" font-size="12" font-weight="700" fill="${AUBE.encre}">${escapeHtml(label)}</text>`,
      `<text x="${x + CELL_WIDTH / 2}" y="${y + 164}" text-anchor="middle" font-size="11" fill="#4d6a5e">${escapeHtml(objectOf(ref))}</text>`,
    ].join("");
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif">`,
    `<rect width="${width}" height="${height}" fill="${AUBE.fond}"/>`,
    `<text x="16" y="26" font-size="16" font-weight="700" fill="${AUBE.encre}">Libre IA · 40 emblèmes, l'objet porte l'oiseau (planche de recette)</text>`,
    ...cells,
    "</svg>",
    "",
  ].join("\n");
}

if (import.meta.main) {
  const output = process.argv[2];
  if (output === undefined) throw new Error("usage: bun src/brand/planche.ts <output.svg>");
  await Bun.write(output, renderPlanche());
}
