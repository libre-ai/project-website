import { describe, expect, test } from "bun:test";

import { facetShades } from "../design/palette";
import { MARTINET_PATHS } from "./martinet-paths";
import { OBJECT_OF, objectFacets } from "./objects";
import { SPECIES } from "./species";
import {
  EMBLEM_REFS,
  emblemFacets,
  emblemUse,
  martinetUse,
  renderFavicon,
  renderSprite,
  SPRITE_BUDGET_BYTES,
} from "./sprite";

const sprite = renderSprite();
const symbols = [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]);

describe("sprite (ADR 0004 §6)", () => {
  test("holds the martinet and one emblem per application, P01 to P40", () => {
    const expected = Array.from({ length: 40 }, (_, i) => `p${String(i + 1).padStart(2, "0")}`);
    expect(EMBLEM_REFS).toEqual(expected);
    expect(symbols).toEqual(["martinet", ...expected.map((ref) => `embleme-${ref}`)]);
  });

  test("is deterministic", () => {
    expect(renderSprite()).toBe(sprite);
  });

  test("is a standalone SVG document with no style attribute, no style element and no script", () => {
    expect(sprite.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(sprite).not.toMatch(/\sstyle=|<style|<script|on[a-z]+=/i);
  });

  test("draws facets with universe tone variables, never a literal facet colour", () => {
    const fills = new Set([...sprite.matchAll(/fill="([^"]+)"/g)].map((match) => match[1]));
    const tones = [...fills].filter((fill) => fill?.startsWith("var(--facette-"));
    expect(tones.sort()).toEqual([1, 2, 3, 4, 5].map((n) => `var(--facette-${n})`));
    // The only fixed colours are a species' own: its accent shades, a pale belly, a white eye.
    const speciesColours = new Set<string>(["#f6faf8", "#ffffff"]);
    for (const species of Object.values(SPECIES)) {
      if (species.accent !== undefined)
        for (const hex of facetShades(species.accent)) speciesColours.add(hex);
    }
    for (const fill of fills) {
      if (fill?.startsWith("#")) expect(speciesColours.has(fill)).toBe(true);
      else
        expect(fill).toMatch(
          /^(var\(--(facette-[1-5]|encre|encre-marque)\)|url\(#aube-degrade\))$/,
        );
    }
  });

  test("objects are drawn with tones only: no literal colour in any emblem's object", () => {
    for (const ref of EMBLEM_REFS) {
      const kind = OBJECT_OF[ref.toUpperCase()];
      expect(kind).toBeDefined();
      const objectCount = kind === undefined ? 0 : objectFacets(kind).length;
      const objectFills = emblemFacets(ref)
        .slice(0, objectCount)
        .map((facet) => facet.fill);
      for (const fill of objectFills)
        expect(fill).toMatch(/^var\(--(facette-[1-5]|encre-marque)\)$/);
    }
  });

  test("carries the martinet paths exactly once", () => {
    expect(sprite.split(MARTINET_PATHS.body)).toHaveLength(2);
    expect(sprite.split(MARTINET_PATHS.wing)).toHaveLength(2);
  });

  test(`stays within ${SPRITE_BUDGET_BYTES} bytes`, () => {
    expect(new TextEncoder().encode(sprite).length).toBeLessThanOrEqual(SPRITE_BUDGET_BYTES);
  });
});

describe("references to the sprite", () => {
  test("a labelled martinet is an image with its name; an unlabelled one is hidden", () => {
    expect(martinetUse("Libre IA")).toContain('role="img"');
    expect(martinetUse("Libre IA")).toContain('aria-label="Libre IA"');
    expect(martinetUse(null)).toContain('aria-hidden="true"');
    expect(martinetUse(null)).toContain('href="/assets/volee.svg#martinet"');
  });

  test("never copies the martinet paths into the page", () => {
    expect(martinetUse("Libre IA")).not.toContain(MARTINET_PATHS.body.slice(0, 40));
  });

  test("an emblem is referenced by application reference, escaped", () => {
    expect(emblemUse("P07")).toContain('href="/assets/volee.svg#embleme-p07"');
    expect(() => emblemUse("P41")).toThrow("sprite.emblem_unknown");
  });

  test("escapes the label of a martinet", () => {
    expect(martinetUse('a"<b')).toContain('aria-label="a&quot;&lt;b"');
  });
});

describe("favicon", () => {
  test("is a standalone SVG of the martinet, with its gradient and an ink wing", () => {
    const icon = renderFavicon();
    expect(icon.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(icon).toContain(MARTINET_PATHS.body);
    expect(icon).toContain(MARTINET_PATHS.wing);
    expect(icon).toContain('id="aube-degrade"');
    expect(icon).not.toMatch(/<use|var\(|\sstyle=|<script/);
  });
});
