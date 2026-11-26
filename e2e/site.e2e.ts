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
  test("the home page, factory tour and waitlist work with JavaScript disabled", async ({
    page,
  }, testInfo) => {
    test.skip(!scriptless(testInfo.project.name), "the scriptless project proves it");
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Possédez la fabrique." }),
    ).toBeVisible();
    await expect(page.locator(".planche .embleme")).toBeVisible();
    await expect(page.locator(".moment")).toHaveCount(4);
    for (const moment of await page.locator(".moment").all()) await expect(moment).toBeVisible();
    // The mission order shows all five sheets flat, and the transfer both halves.
    await expect(page.locator(".ordre-feuille")).toHaveCount(5);
    for (const sheet of await page.locator(".ordre-feuille").all())
      await expect(sheet).toBeVisible();
    await expect(page.locator(".virement-demi")).toHaveCount(2);
    for (const half of await page.locator(".virement-demi").all()) await expect(half).toBeVisible();
    const comparison = page.locator("#parcours");
    const rows = comparison.locator("tbody tr");
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(comparison.getByRole("columnheader")).toHaveText(["Avant", "Après"]);
    await expect(rows).toHaveCount(4);
    for (const row of await rows.all()) {
      const before = await row.getByRole("cell").first().boundingBox();
      const after = await row.getByRole("cell").last().boundingBox();
      if (before === null || after === null) throw new Error("missing comparison cells");
      expect(after.y).toBe(before.y);
      expect(after.x).toBeGreaterThanOrEqual(before.x + before.width);
      expect(after.x + after.width).toBeLessThanOrEqual(390);
    }
    const aviary = page.locator("#univers");
    await expect(aviary.getByRole("heading", { level: 3 })).toHaveCount(8);
    await expect(aviary.getByRole("link", { name: "Voir les applications" })).toHaveAttribute(
      "href",
      "/applications/",
    );
    const delivery = page.getByRole("region", { name: "L'application livrée, pièce par pièce." });
    await expect(delivery.getByText("Illustration", { exact: true })).toBeVisible();
    await expect(delivery.getByText("Agenda", { exact: true })).toBeVisible();
    const pieces = delivery.getByRole("listitem");
    await expect(pieces).toHaveCount(6);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const piece of await pieces.all()) {
        await expect(piece).toBeVisible();
        const bounds = await piece.boundingBox();
        if (bounds === null) throw new Error("missing delivery piece bounds");
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
    }
    await expect(page.locator("#preuves li")).toHaveCount(6);
    const questions = page.locator("#questions details");
    await expect(questions).toHaveCount(3);
    for (const question of await questions.all()) {
      await question.locator("summary").click();
      await expect(question.locator("p")).toBeVisible();
    }
    await page.getByRole("link", { name: "Transformer mon entreprise" }).click();
    await expect(page).toHaveURL(/#commencer$/);
    await expect(page.locator("#commencer li")).toHaveCount(3);
    await expect(page.locator("[data-theme-toggle]")).toBeHidden();
    await page
      .locator("#rejoindre")
      .getByRole("link", { name: /Rejoindre la liste d['’]attente/ })
      .click();
    await expect(page.locator('form[action="/inscription"]')).toBeVisible();
    await page.goto("/fabrique/");
    await expect(page.locator(".visite")).toBeVisible();
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

  test("the mission order shows one service at a time, chosen from its tabs", async ({
    page,
  }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "needs the module");
    await page.goto("/");
    const services = page.getByRole("tablist", { name: "Services" });
    const tabs = services.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    await expect(page.locator(".ordre-feuille:visible")).toHaveCount(1);
    await expect(page.locator("#ordre-compta")).toBeVisible();
    await tabs.filter({ hasText: "Ressources humaines" }).click();
    await expect(page.locator(".ordre-feuille:visible")).toHaveCount(1);
    await expect(page.locator("#ordre-rh")).toBeVisible();
    await expect(page.locator("#ordre-rh .ordre-talon")).toContainText("refusé par Autorisation");
  });

  // The fonts swap in after the script ran: the indicator has to follow a tab that changes size,
  // or it keeps the width of the fallback font (a race that made a visual capture unstable).
  test("the tab indicator follows the selected tab when it changes size", async ({
    page,
  }, testInfo) => {
    test.skip(scriptless(testInfo.project.name), "needs the module");
    await page.goto("/applications/");
    const tab = page.getByRole("tab").first();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await tab.evaluate((link) => {
      link.style.paddingInline = "3rem";
    });
    const measure = (): Promise<[string, string]> =>
      tab.evaluate((link) => [
        `${(link as HTMLElement).offsetWidth}px`,
        (link.closest("[data-onglets-liste]") as HTMLElement).style.getPropertyValue(
          "--indicateur-largeur",
        ),
      ]);
    await expect.poll(async () => new Set(await measure()).size).toBe(1);
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
