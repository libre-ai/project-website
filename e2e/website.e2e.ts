import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const outputRoot = resolve(process.env.LIBRE_AI_WEBSITE_OUTPUT_ROOT ?? "dist");
const homeUrl = pathToFileURL(join(outputRoot, "index.html")).href;
test("renders the twenty current projects in their three groups", async ({ page }) => {
  await page.goto(homeUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Travailler et apprendre avec l’IA",
  );
  await expect(page.locator("#products article")).toHaveCount(8);
  await expect(page.locator("#components article")).toHaveCount(9);
  await expect(page.locator("#project article")).toHaveCount(3);
  await expect(page.locator(".availability")).toContainText("intégration et de test local");
  await expect(page.locator("script")).toHaveCount(0);
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Work and learn with AI");
  await expect(page.locator("article")).toHaveCount(20);
});

test("loads no remote resource", async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });
  await page.goto(homeUrl);
  await expect(page.locator("body")).toBeVisible();
  expect(remoteRequests).toEqual([]);
});

test("keeps the skip path and narrow reflow usable", async ({ page }) => {
  await page.goto(homeUrl);
  const skipLink = page.getByRole("link", { name: "Aller au contenu" });
  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await skipLink.press("Enter");
  expect(page.url().endsWith("#contenu")).toBe(true);

  for (const width of [640, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test("does not imply product readiness or publish historical brand assets", async ({ page }) => {
  await page.goto(homeUrl);
  await expect(page.locator(".availability")).toContainText("pas des services déployés");
  await expect(page.locator('img[src*="libre-ai-mark"]')).toHaveCount(0);
  await expect(page.locator('a[href*="libre-ai-mark"]')).toHaveCount(0);
  await expect(page.locator('a[href*="/starter/"]')).toHaveCount(0);
});

test("captures one disposable Chromium review surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "One canonical review capture is sufficient");
  await page.goto(homeUrl);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("website-home.png") });
});
