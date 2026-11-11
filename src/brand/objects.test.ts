import { describe, expect, test } from "bun:test";
import { OBJECT_OF, type ObjectKind, objectFacets, PERCH_SEGMENT } from "./objects";
import { EMBLEM_REFS } from "./sprite";

const kinds = [...new Set(Object.values(OBJECT_OF))] as ObjectKind[];

describe("origami objects carrying the birds (ADR 0004 §5)", () => {
  test("every application declares an object, and no two applications share one", () => {
    expect(Object.keys(OBJECT_OF).sort()).toEqual(EMBLEM_REFS.map((ref) => ref.toUpperCase()));
    expect(kinds).toHaveLength(EMBLEM_REFS.length);
  });

  test.each(
    kinds.map((kind) => [kind] as const),
  )("%s has 3 to 16 facets inside the box", (kind) => {
    const facets = objectFacets(kind);
    expect(facets.length).toBeGreaterThanOrEqual(3);
    expect(facets.length).toBeLessThanOrEqual(16);
    for (const facet of facets) {
      expect(facet.points.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of facet.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(PERCH_SEGMENT.y);
        expect(y).toBeLessThanOrEqual(100);
      }
    }
  });

  test.each(
    kinds.map((kind) => [kind] as const),
  )("%s offers a surface for the bird to stand on", (kind) => {
    const top = Math.min(...objectFacets(kind).flatMap((facet) => facet.points.map(([, y]) => y)));
    expect(top).toBeCloseTo(PERCH_SEGMENT.y, 5);
  });

  test("facets use the five universe tones and the ink only", () => {
    for (const kind of kinds) {
      for (const facet of objectFacets(kind))
        expect([1, 2, 3, 4, 5, "encre"]).toContain(facet.tone);
    }
  });
});
