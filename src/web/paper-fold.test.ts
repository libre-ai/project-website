import { expect, test } from "bun:test";
import type { Facet } from "../brand/birds";
import { facetHinges } from "./paper-fold";

test("joins opposite windings along the same rendered edge", () => {
  const facets: Facet[] = [
    {
      fill: "currentColor",
      points: [
        [0, 0],
        [10, 5],
        [1, 6],
      ],
    },
    {
      fill: "currentColor",
      points: [
        [10.1, 5],
        [0, 0],
        [8, 0],
      ],
    },
  ];
  expect(facetHinges(facets)).toEqual([
    [0, 0, 20, 10],
    [20, 10, -20, -10],
  ]);
});

test("folds an isolated facet in place about its centre", () => {
  const facets: Facet[] = [
    {
      fill: "currentColor",
      points: [
        [3, 3],
        [6, 9],
        [9, 3],
      ],
    },
  ];
  expect(facetHinges(facets)).toEqual([[12, 10, 1, 0]]);
});
