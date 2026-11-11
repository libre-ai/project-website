import { describe, expect, test } from "bun:test";

import { diffOutputs } from "./determinism";

const files = (entries: [string, string | Uint8Array][]) => new Map(entries);

describe("diffOutputs (S6.4)", () => {
  test("identical outputs have no difference", () => {
    const a = files([
      ["a.html", "x"],
      ["b.bin", new Uint8Array([1, 2])],
    ]);
    const b = files([
      ["b.bin", new Uint8Array([1, 2])],
      ["a.html", "x"],
    ]);
    expect(diffOutputs(a, b)).toEqual([]);
  });

  test("a changed text file, a changed binary and a missing path are each named", () => {
    const a = files([
      ["a.html", "x"],
      ["b.bin", new Uint8Array([1, 2])],
      ["only-a.txt", "y"],
    ]);
    const b = files([
      ["a.html", "z"],
      ["b.bin", new Uint8Array([1, 3])],
      ["only-b.txt", "y"],
    ]);
    expect(diffOutputs(a, b)).toEqual(["a.html", "b.bin", "only-a.txt", "only-b.txt"]);
  });
});

// The determinism of the Libre IA assembly itself is tested in src/web/site.test.ts.
