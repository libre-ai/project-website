import { describe, expect, test } from "bun:test";

import { findInlineStyles } from "../web/gates";
import { hoistStyles } from "../web/hoist";
import { layers, tour } from "./factory";
import { journeys } from "./journeys";
import { PROTOTYPE_KEY_OF, refOfPrototypeKey } from "./prototype-keys";
import { showcaseOf, showcases } from "./showcases";
import { UNIVERSE_OF } from "./universes";

describe("content ported from the accepted prototype (plan, Task 4)", () => {
  test("every application P01 to P40 has a prototype key, each used once", () => {
    expect(Object.keys(PROTOTYPE_KEY_OF).sort()).toEqual(Object.keys(UNIVERSE_OF).sort());
    expect(new Set(Object.values(PROTOTYPE_KEY_OF)).size).toBe(40);
    expect(() => refOfPrototypeKey("inconnu")).toThrow("content.prototype_key_unknown");
  });

  test("every application has a showcase: a function label, three tags and a demo", () => {
    expect(Object.keys(showcases).sort()).toEqual(Object.values(PROTOTYPE_KEY_OF).sort());
    for (const ref of Object.keys(PROTOTYPE_KEY_OF)) {
      const showcase = showcaseOf(ref);
      expect(showcase.category.length).toBeGreaterThan(0);
      expect(showcase.tags).toHaveLength(3);
      expect(showcase.demo.length).toBeGreaterThan(0);
    }
    expect(() => showcaseOf("P41")).toThrow("content.showcase_missing");
  });

  test("every demo hoists cleanly: no inline style left, no refused declaration", () => {
    for (const ref of Object.keys(PROTOTYPE_KEY_OF)) {
      const hoisted = hoistStyles(showcaseOf(ref).demo, ref.toLowerCase());
      expect(findInlineStyles(hoisted.html)).toEqual([]);
    }
  });

  test("journeys name existing applications only", () => {
    expect(journeys.length).toBeGreaterThan(0);
    for (const journey of journeys) {
      for (const key of journey.apps) expect(() => refOfPrototypeKey(key)).not.toThrow();
    }
  });

  test("the guided tour has seven steps and the explorer its layers", () => {
    expect(tour).toHaveLength(7);
    expect(layers.length).toBeGreaterThan(0);
  });

  test("no content carries an email address", () => {
    const all = JSON.stringify({ showcases, journeys, tour, layers });
    expect(all).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
});
