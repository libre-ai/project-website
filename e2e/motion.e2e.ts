import { expect, test } from "@playwright/test";

// O5 / FR-16: the frames appear with a short CSS shift, and only for a visitor who has not asked
// for reduced motion. The computed style is read, not a frame of an animation that may be over.
const LIST = "/produits";

async function frameAnimationNames(page: import("@playwright/test").Page): Promise<string[]> {
  return page
    .locator(".frame")
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).animationName));
}

test.describe("FR-16 : mouvement réduit demandé", () => {
  test.use({ reducedMotion: "reduce" });

  test("no frame is animated and no animation is running", async ({ page }) => {
    await page.goto(LIST);
    const names = await frameAnimationNames(page);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name === "none")).toBe(true);
    const running = await page.evaluate(() => document.getAnimations().length);
    expect(running).toBe(0);
  });
});

test.describe("FR-16 : aucune préférence", () => {
  test.use({ reducedMotion: "no-preference" });

  test("every frame carries the appearance", async ({ page }) => {
    await page.goto(LIST);
    const names = await frameAnimationNames(page);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name === "frame-appear")).toBe(true);
  });

  test("the page is usable without script: the content is present, not waiting on the animation", async ({
    page,
  }) => {
    await page.goto(LIST);
    await expect(page.getByRole("heading", { level: 1, name: "Produits" })).toBeVisible();
  });
});
