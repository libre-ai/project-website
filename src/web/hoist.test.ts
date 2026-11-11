import { describe, expect, test } from "bun:test";

import { findInlineStyles } from "./gates";
import { hoistStyles } from "./hoist";

describe("hoistStyles (plan, Task 4: micro-demos under style-src 'self')", () => {
  test("moves each style attribute into a generated class and a matching rule", () => {
    const result = hoistStyles(
      '<span class="d-noeud" style="--i:2;left:45%;top:22%">Rapport</span>',
      "p01",
    );
    expect(result.html).toBe('<span class="d-noeud s-p01-1">Rapport</span>');
    expect(result.css).toBe(".s-p01-1{--i:2;left:45%;top:22%}");
  });

  test("adds a class attribute where there was none", () => {
    expect(hoistStyles('<b style="--w:70%">x</b>', "p02").html).toBe('<b class="s-p02-1">x</b>');
  });

  test("gives identical declarations one shared class", () => {
    const result = hoistStyles(
      '<i style="--i:1"></i><i style="--i:1"></i><i style="--i: 2"></i>',
      "p03",
    );
    expect(result.html).toBe(
      '<i class="s-p03-1"></i><i class="s-p03-1"></i><i class="s-p03-2"></i>',
    );
    expect(result.css).toBe(".s-p03-1{--i:1}\n.s-p03-2{--i: 2}");
  });

  test("leaves no inline style behind and is deterministic", () => {
    const html = '<div style="--i:0"><span style="left:1%" class="a">x</span></div>';
    const first = hoistStyles(html, "p04");
    expect(findInlineStyles(first.html)).toEqual([]);
    expect(hoistStyles(html, "p04")).toEqual(first);
  });

  test("refuses a declaration that could reach outside the rule or load anything", () => {
    expect(() => hoistStyles('<i style="color:red}body{display:none"></i>', "p05")).toThrow(
      "hoist.declaration_refused",
    );
    expect(() =>
      hoistStyles('<i style="background:url(https://x.example/a.png)"></i>', "p05"),
    ).toThrow("hoist.declaration_refused");
    expect(() => hoistStyles("<i style='left:1%'></i>", "p05")).toThrow("hoist.quote_refused");
  });

  test("refuses a prefix that is not a plain identifier", () => {
    expect(() => hoistStyles("<i></i>", "p 1")).toThrow("hoist.prefix_invalid");
  });
});
