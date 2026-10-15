import { describe, expect, test } from "bun:test";

import { checkBudget, PAGE_BUDGET_BYTES, pageWeights } from "./budget";

const page = (links: string[]) =>
  `<!doctype html><link rel="stylesheet" href="/assets/tokens.css">${links
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("")}<main>x</main>`;

describe("pageWeights (S6.5)", () => {
  test("a page weighs itself, its stylesheets and the fonts those stylesheets load", () => {
    const html = page(["/assets/styles.css"]);
    const files = new Map<string, string | Uint8Array>([
      ["index.html", html],
      ["assets/tokens.css", "a".repeat(100)],
      // The quoted form is the one the real stylesheet uses (renderFontFace).
      ["assets/styles.css", '@font-face{src:url("/assets/fonts/f.woff2")}'],
      ["assets/fonts/f.woff2", new Uint8Array(1000)],
    ]);
    const [weight] = pageWeights(files);
    const styles = new TextEncoder().encode('@font-face{src:url("/assets/fonts/f.woff2")}').length;
    expect(weight?.page).toBe("index.html");
    expect(weight?.bytes).toBe(new TextEncoder().encode(html).length + 100 + styles + 1000);
  });

  test("multibyte text is counted in bytes, not characters", () => {
    const files = new Map<string, string | Uint8Array>([
      ["index.html", '<link href="/assets/tokens.css">é'],
      ["assets/tokens.css", ""],
    ]);
    const [weight] = pageWeights(files);
    expect(weight?.bytes).toBe(
      new TextEncoder().encode('<link href="/assets/tokens.css">é').length,
    );
  });

  test("a shared asset is counted once per page", () => {
    const files = new Map<string, string | Uint8Array>([
      ["index.html", page(["/assets/tokens.css"])],
      ["assets/tokens.css", "a".repeat(50)],
    ]);
    const [weight] = pageWeights(files);
    expect(weight?.bytes).toBe(new TextEncoder().encode(page(["/assets/tokens.css"])).length + 50);
  });

  test("a referenced asset that is not in the output fails closed", () => {
    const files = new Map<string, string | Uint8Array>([
      ["index.html", page(["/assets/gone.css"])],
      ["assets/tokens.css", ""],
    ]);
    expect(() => pageWeights(files)).toThrow("budget.asset_missing:assets/gone.css");
  });

  test("an output without any page fails closed", () => {
    expect(() => pageWeights(new Map())).toThrow("budget.no_pages");
  });
});

describe("checkBudget", () => {
  test("reports the heaviest page and the number examined", () => {
    const files = new Map<string, string | Uint8Array>([
      ["index.html", '<link href="/assets/a.css">'],
      ["mission/index.html", '<link href="/assets/a.css">xxxxxxxxxx'],
      ["assets/a.css", "a".repeat(10)],
    ]);
    const report = checkBudget(files);
    expect(report.examined).toBe(2);
    expect(report.heaviest.page).toBe("mission/index.html");
    expect(report.violations).toEqual([]);
  });

  test("a page over the budget is a violation naming the page", () => {
    const files = new Map<string, string | Uint8Array>([
      ["index.html", '<link href="/assets/a.css">'],
      ["assets/a.css", "a".repeat(PAGE_BUDGET_BYTES)],
    ]);
    expect(checkBudget(files).violations).toEqual([expect.stringContaining("index.html")]);
  });

  test("the budget is 150 KiB", () => {
    expect(PAGE_BUDGET_BYTES).toBe(150 * 1024);
  });
});
