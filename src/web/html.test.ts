import { describe, expect, test } from "bun:test";

import { fragment, h, raw, render } from "./html";

describe("escaped HTML builder (ADR 0005)", () => {
  test("escapes text children and attribute values", () => {
    expect(render(h("p", { title: 'a"<b' }, "1 < 2 & 3"))).toBe(
      '<p title="a&quot;&lt;b">1 &lt; 2 &amp; 3</p>',
    );
  });

  test("passes trusted markup through raw only", () => {
    expect(render(h("div", {}, raw("<svg></svg>")))).toBe("<div><svg></svg></div>");
  });

  test("renders boolean attributes by presence and drops absent ones", () => {
    expect(
      render(h("button", { hidden: true, disabled: false, title: null, type: "button" })),
    ).toBe('<button hidden type="button"></button>');
  });

  test("closes no void element and flattens nested children", () => {
    expect(render(h("p", {}, ["a", ["b", null, false, undefined], 3], h("br", {})))).toBe(
      "<p>ab3<br></p>",
    );
    expect(render(fragment(h("hr", {}), "x"))).toBe("<hr>x");
  });

  test("refuses an inline style, an event handler and a style element", () => {
    expect(() => h("p", { style: "color:red" })).toThrow("html.attribute_refused:style");
    expect(() => h("a", { onclick: "x()" })).toThrow("html.attribute_refused:onclick");
    expect(() => h("style", {})).toThrow("html.tag_refused:style");
  });

  test("allows a script only as an external file, never with content", () => {
    expect(render(h("script", { src: "/assets/main.js", type: "module" }))).toBe(
      '<script src="/assets/main.js" type="module"></script>',
    );
    expect(() => h("script", {}, "alert(1)")).toThrow("html.inline_script_refused");
    expect(() => h("script", {})).toThrow("html.inline_script_refused");
  });

  test("refuses a tag or attribute name that is not a plain identifier", () => {
    expect(() => h("p onload", {})).toThrow("html.tag_invalid");
    expect(() => h("p", { 'x" onfocus="y': "1" })).toThrow("html.attribute_invalid");
  });

  test("refuses a javascript: URL in a link or a form", () => {
    expect(() => h("a", { href: " JavaScript:alert(1)" })).toThrow("html.url_refused");
    expect(() => h("form", { action: "javascript:x" })).toThrow("html.url_refused");
  });
});
