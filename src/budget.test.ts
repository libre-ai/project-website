import { describe, expect, test } from "bun:test";

import {
  ASSET_BUDGETS,
  checkAssetBudgets,
  checkBudget,
  PAGE_BUDGET_BYTES,
  pageWeights,
} from "./budget";

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
    // A font is already compressed: its transferred size is its size.
    const files = new Map<string, string | Uint8Array>([
      ["index.html", '<link href="/assets/a.css">'],
      ["assets/a.css", '@font-face{src:url("/assets/fonts/f.woff2")}'],
      ["assets/fonts/f.woff2", crypto.getRandomValues(new Uint8Array(PAGE_BUDGET_BYTES + 1))],
    ]);
    expect(checkBudget(files).violations).toEqual([expect.stringContaining("index.html")]);
  });

  test("a compressible page is judged on what is transferred, not on its raw size", () => {
    const files = new Map<string, string | Uint8Array>([
      ["index.html", '<link href="/assets/a.css">'],
      ["assets/a.css", "a".repeat(PAGE_BUDGET_BYTES * 2)],
    ]);
    const report = checkBudget(files);
    expect(report.violations).toEqual([]);
    expect(report.heaviest.bytes).toBeGreaterThan(PAGE_BUDGET_BYTES);
    expect(report.heaviest.gzipBytes).toBeLessThan(PAGE_BUDGET_BYTES);
  });

  test("the budget is 120 KiB transferred (gzip)", () => {
    expect(PAGE_BUDGET_BYTES).toBe(120 * 1024);
  });
});

describe("pageWeights counts every asset a page loads (plan, Task 9)", () => {
  test("scripts, sprite references and the icon are part of the page", () => {
    const html =
      '<link rel="icon" href="/assets/m.svg"><script src="/assets/theme-init.js"></script>' +
      '<script src="/assets/main.js" type="module"></script>' +
      '<svg><use href="/assets/volee.svg#martinet"/></svg><svg><use href="/assets/volee.svg#embleme-p01"/></svg>';
    const files = new Map<string, string | Uint8Array>([
      ["index.html", html],
      ["assets/m.svg", "m".repeat(10)],
      ["assets/theme-init.js", "t".repeat(20)],
      ["assets/main.js", "j".repeat(30)],
      ["assets/volee.svg", "v".repeat(40)],
    ]);
    const [weight] = pageWeights(files);
    expect(weight?.bytes).toBe(new TextEncoder().encode(html).length + 10 + 20 + 30 + 40);
  });
});

describe("checkAssetBudgets", () => {
  test("holds the script, the stylesheet and the sprite to their own ceilings", () => {
    const files = new Map<string, string | Uint8Array>([
      ["assets/main.js", "j".repeat(ASSET_BUDGETS["assets/main.js"] + 1)],
      ["assets/site.css", "c".repeat(10)],
      ["assets/volee.svg", "v".repeat(10)],
    ]);
    const report = checkAssetBudgets(files);
    expect(report.examined).toBe(3);
    expect(report.violations).toEqual([
      `budget.asset_over:assets/main.js:${ASSET_BUDGETS["assets/main.js"] + 1}`,
    ]);
  });

  test("declares the planned ceilings", () => {
    expect(ASSET_BUDGETS).toEqual({
      "assets/main.js": 16 * 1024,
      "assets/site.css": 48 * 1024,
      "assets/volee.svg": 80 * 1024,
    });
  });

  test("a missing asset is a failure, never a pass", () => {
    expect(checkAssetBudgets(new Map()).violations).toEqual([
      "budget.asset_missing:assets/main.js",
      "budget.asset_missing:assets/site.css",
      "budget.asset_missing:assets/volee.svg",
    ]);
  });
});
