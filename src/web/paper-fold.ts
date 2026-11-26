import type { Facet, Point } from "../brand/birds";
import { EMBLEM_BOX, EMBLEM_VIEWBOX, emblemFacets, facetPaths } from "../brand/sprite";
import { type Html, raw } from "./html";

type Hinge = readonly [originX: number, originY: number, axisX: number, axisY: number];

function edgeKey(start: Point, end: Point): string {
  return [start.join(","), end.join(",")].sort().join("/");
}

export function facetHinges(facets: readonly Facet[]): Hinge[] {
  const scale = EMBLEM_BOX / 100;
  const outlines = facets.map((facet) =>
    facet.points.map(([x, y]): Point => [Math.round(x * scale), Math.round(y * scale)]),
  );
  const edges = outlines.map((points) =>
    points.flatMap((start, index) => {
      const end = points[(index + 1) % points.length];
      if (end === undefined || (start[0] === end[0] && start[1] === end[1])) return [];
      return [{ start, end, key: edgeKey(start, end) }];
    }),
  );
  const neighbours = edges.map((boundary) => new Set(boundary.map(({ key }) => key)));

  return edges.map((boundary, index) => {
    let hinge: Hinge | null = null;
    let longest = 0;
    for (const { start, end, key } of boundary) {
      const axisX = end[0] - start[0];
      const axisY = end[1] - start[1];
      const length = axisX ** 2 + axisY ** 2;
      if (
        length > longest &&
        neighbours.some((edges, other) => other !== index && edges.has(key))
      ) {
        hinge = [start[0], start[1], axisX, axisY];
        longest = length;
      }
    }
    if (hinge !== null) return hinge;
    const points = outlines[index] ?? [];
    const centre = (axis: 0 | 1): number =>
      Math.round(points.reduce((sum, point) => sum + point[axis], 0) / Math.max(1, points.length));
    return [centre(0), centre(1), 1, 0];
  });
}

export function foldingEmblem(ref: string): Html {
  const facets = emblemFacets(ref);
  const parts = facetHinges(facets).map(([x, y, axisX, axisY], index) => {
    const facet = facets[index];
    if (facet === undefined) throw new Error("home.facet_missing");
    const hinge = `${(100 * x) / EMBLEM_BOX}% ${(100 * y) / EMBLEM_BOX}% ${axisX},${axisY}`;
    return `<g data-charniere="${hinge}">${facetPaths([facet])}</g>`;
  });
  return raw(
    `<svg class="embleme" viewBox="${EMBLEM_VIEWBOX}" aria-hidden="true">${parts.join("")}</svg>`,
  );
}
