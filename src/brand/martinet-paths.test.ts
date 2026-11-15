import { describe, expect, test } from "bun:test";

import { MARTINET_PATHS, MARTINET_TRANSFORM, MARTINET_VIEWBOX } from "./martinet-paths";

// I-39 (project-governance): an asset lives in the repository that uses it, and a test compares
// what the code carries with its source. The martinet paths are copied from this file, so the
// copy is checked against it rather than trusted.
const SOURCE_PATH = new URL("./source/libre-ia-icon-dark.svg", import.meta.url);

async function readSource(): Promise<string> {
  const file = Bun.file(SOURCE_PATH);
  // A missing source fails here: a skipped comparison would leave the copy unverified.
  expect(await file.exists()).toBe(true);
  return file.text();
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function numbersOf(transform: string): number[] {
  return [...transform.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

describe("martinet paths against their source (I-39)", () => {
  test("the source holds exactly two paths, body then wing, equal to the module's", async () => {
    const source = await readSource();
    const paths = [...source.matchAll(/<path\s+d="([^"]+)"/g)].map((match) =>
      collapseWhitespace(match[1] ?? ""),
    );
    expect(paths).toEqual([MARTINET_PATHS.body, MARTINET_PATHS.wing]);
  });

  test("the source box and transform match the module's", async () => {
    const source = await readSource();
    expect(source).toContain(`viewBox="${MARTINET_VIEWBOX}"`);
    const transform = source.match(/<g\s+transform="([^"]+)"/)?.[1];
    expect(transform).toBeDefined();
    expect(numbersOf(transform ?? "")).toEqual(numbersOf(MARTINET_TRANSFORM));
    expect(transform?.replace(/[-\d.]+/g, "#")).toBe(MARTINET_TRANSFORM.replace(/[-\d.]+/g, "#"));
  });
});
