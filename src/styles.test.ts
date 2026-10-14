import { describe, expect, test } from "bun:test";

import { renderSiteCss } from "./styles";

describe("website-owned brand CSS", () => {
  test("uses only shared color tokens and no gradients", () => {
    const css = renderSiteCss();
    const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");

    expect(withoutComments).not.toMatch(/#[0-9a-f]{3,8}\b|\brgb\(|\bhsl\(|\boklch\(/i);
    expect(withoutComments).not.toMatch(/linear-gradient|radial-gradient/i);
    expect(css).toContain("var(--lai-color-accent)");
    expect(renderSiteCss()).toBe(css);
  });
});

describe("brand grammar in the site CSS (ADR 0002)", () => {
  test("frames and labels are square-cornered: the joint is orthogonal", () => {
    const css = renderSiteCss();
    expect(css).toMatch(/\.frame\s*\{[^}]*border-radius:\s*0/);
    expect(css).toMatch(/\.label\s*\{[^}]*border:/);
  });

  test("motion is limited to transitions that reduced-motion turns off", () => {
    const css = renderSiteCss();
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*transition:\s*none/);
    expect(css).not.toMatch(/@keyframes/);
  });
});

describe("frame lists align with the text column", () => {
  test("a list made of frames drops the default indent so the frames sit on the column", () => {
    expect(renderSiteCss()).toMatch(/ul:has\(> \.frame\)\s*\{[^}]*padding-inline-start:\s*0/);
  });
});
