import { expect, test } from "@playwright/test";

import { APPLICATIONS } from "../src/content/applications";

// Visual regression (plan, Task 15): four pages, phone and desktop, light and dark, Chromium
// only, every animation stopped. Baselines are per platform (playwright.config.ts): the Linux ones
// come from a reviewed CI run, never from this machine.
const APPLICATION = APPLICATIONS[0];
if (APPLICATION === undefined) throw new Error("no application");
const PAGES: readonly (readonly [string, string])[] = [
  ["accueil", "/"],
  ["applications", "/applications/"],
  ["application", `/applications/${APPLICATION.slug}/`],
  ["fabrique", "/fabrique/"],
];

for (const [name, path] of PAGES) {
  for (const width of [390, 1440]) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${name} at ${width} px, ${scheme}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "baselines are taken on Chromium only");
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page).toHaveScreenshot(`${name}-${width}-${scheme}.png`, {
          fullPage: true,
          animations: "disabled",
        });
      });
    }
  }
}
