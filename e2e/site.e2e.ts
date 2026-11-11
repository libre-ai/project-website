import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { APPLICATIONS } from "../src/content/applications";

// One route per kind of page: home, index, application, factory, join, about, privacy, forge,
// subscription and error pages. Each kind shares its layout and components with its siblings.
const APPLICATION = APPLICATIONS[6];
if (APPLICATION === undefined) throw new Error("no application");
const ROUTES = [
  "/",
  "/applications/",
  `/applications/${APPLICATION.slug}/`,
  "/fabrique/",
  "/rejoindre/",
  "/a-propos/",
  "/confidentialite/",
  "/preuves/",
  "/licences/",
  "/fabrique/briques/project-governance/",
  "/inscription/merci/",
];
const ORIGIN = "http://localhost:8080";

const scriptless = (name: string): boolean => name === "chromium-no-js";

async function cspViolations(page: Page, path: string): Promise<string[]> {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Content-Security-Policy|CSP/i.test(message.text())) {
      messages.push(message.text());
    }
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return messages;
}

test.describe("every kind of page", () => {
  for (const path of ROUTES) {
    test(`${path}: one h1, the security headers, no CSP violation, no outside request`, async ({
      page,
    }) => {
      const outside: string[] = [];
      page.on("request", (request) => {
        if (!request.url().startsWith(ORIGIN) && !request.url().startsWith("data:"))
          outside.push(request.url());
      });
      const response = await page.goto(path);
      expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
      expect(response?.headers()["x-frame-options"]).toBe("DENY");
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await cspViolations(page, path)).toEqual([]);
      expect(outside).toEqual([]);
    });
  }

  test("an unknown path answers the 404 page", async ({ page }) => {
    const response = await page.goto("/nulle-part/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
  });
});

test.describe("no horizontal scroll at 360, 390 and 1440 px", () => {
  for (const width of [360, 390, 1440]) {
    test(`at ${width} px on every kind of page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ROUTES) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("zero serious or critical axe violation (WCAG 2.2 AA)", () => {
  for (const path of ROUTES) {
    test(`on ${path}`, async ({ page }, testInfo) => {
      test.skip(scriptless(testInfo.project.name), "axe injects a script");
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      const blocking = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        blocking.map((violation) => `${violation.id}: ${violation.nodes.length} nœud(s)`),
        path,
      ).toEqual([]);
    });
  }
});

test.describe("the site is complete without script (ADR 0005 §1)", () => {
  test("first screen, universes, tour and waitlist work with JavaScript disabled", async ({
    page,
  }, testInfo) => {
    test.skip(!scriptless(testInfo.project.name), "the scriptless project proves it");
    await page.goto("/");
    await expect(page.locator(".cote-seul")).toBeVisible();
    await page.getByText("Ensemble", { exact: true }).click();
    await expect(page.locator(".cote-ensemble")).toBeVisible();
    await expect(page.locator(".cote-seul")).toBeHidden();
    await expect(page.locator(".titre-univers").first()).toBeVisible();
    await expect(page.locator("[data-etape]")).toHaveCount(7);
    for (const step of await page.locator("[data-etape]").all()) await expect(step).toBeVisible();
    await expect(page.locator('form[action="/inscription"]').first()).toBeVisible();
    await expect(page.locator("[data-theme-toggle]")).toBeHidden();
  });
});

test.describe("progressive enhancement (ADR 0005 §5)", () => {
  test("the theme toggle is a pressed button with an accessible name, remembered", async ({
    page,
  }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "needs the module");
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Thème sombre" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sombre");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sombre");
  });

  test("a saved dark theme paints dark on the first frame", async ({ page }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "needs the module");
    await page.addInitScript(() => window.localStorage.setItem("libre-ia-theme", "sombre"));
    await page.goto("/", { waitUntil: "commit" });
    await page.waitForSelector("body");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("sombre");
  });

  test("universe tabs follow the ARIA pattern with arrows, Home and End", async ({
    page,
  }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "needs the module");
    await page.goto("/applications/");
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(8);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(tabs.nth(7)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
  });

  test("the guided tour shows one step at a time", async ({ page }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "needs the module");
    await page.goto("/fabrique/");
    const tour = page.locator("[data-visite]");
    await expect(tour.locator("[data-etape]:visible")).toHaveCount(1);
    await tour.getByRole("button", { name: "Étape suivante" }).click();
    await expect(tour.locator(".visite-position")).toHaveText("Étape 2 sur 7");
  });
});

test.describe("reduced motion (ADR 0005 §6)", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing animates on the home page", async ({ page }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "getAnimations needs script");
    await page.goto("/");
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});
