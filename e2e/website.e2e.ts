import { expect, test } from "@playwright/test";

// One block per requirement of the V1 PRD (§5). The server serves the built dist/ over HTTP,
// never file:, so relative and canonical URLs behave as they will in production.
const SAMPLE_PRODUCT = "/produits/execution-sandbox";
// Same origin as SITE_ORIGIN in src/corpus.ts: the canonical URLs must match what is served.
const LOCAL_ORIGIN = "http://localhost:8080";
const EXTERNAL_PREFIX = /^https?:\/\/(?!localhost:8080)/;

test.describe("FR-01 : mission visible sans défilement", () => {
  test("the mission promise is in the first screen at 390×844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const promise = page.getByRole("heading", { level: 1, name: "Possédez la fabrique." });
    const box = await promise.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 9999) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
  });
});

test.describe("FR-02 : aucune URL applicative pour idea ou spec-published", () => {
  test("a spec-published product offers a follow link and no application link", async ({
    page,
  }) => {
    await page.goto(SAMPLE_PRODUCT);
    await expect(page.getByText("Suivre la fiche sur la forge.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ouvrir le produit" })).toHaveCount(0);
  });
});

test.describe("FR-03 : limites au même niveau que les capacités", () => {
  test("a product page has a non-empty Limites section", async ({ page }) => {
    await page.goto(SAMPLE_PRODUCT);
    const limits = page.getByRole("heading", { level: 2, name: "Limites" });
    await expect(limits).toBeVisible();
    await expect(limits.locator("xpath=following-sibling::ul[1]/li").first()).not.toBeEmpty();
  });
});

test.describe("FR-04 : auteur, assistance IA, nature et date de revue", () => {
  // Covered by the unit tests of src/resource.ts: no resource is published yet, so the
  // site has no resource page to inspect end to end.
  test.fixme("resources are checked on the built pages", async () => {});
});

test.describe("FR-05 : journal des corrections dans le pied de page", () => {
  test("every page links to the corrections journal", async ({ page }) => {
    for (const path of ["/", "/mission", "/produits", SAMPLE_PRODUCT, "/corrections"]) {
      await page.goto(path);
      await expect(
        page.locator("footer").getByRole("link", { name: "Journal des corrections" }),
      ).toHaveAttribute("href", "/corrections");
    }
  });
});

test.describe("FR-06 : page des preuves listant chaque gate", () => {
  // Not implemented: /preuves states that counters are printed, but does not yet list the gates.
  test.fixme("the proofs page lists each gate with its counter and command", async () => {});
});

test.describe("FR-07 : lecture sans JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("mission and product list are readable with JavaScript disabled", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Possédez la fabrique." }),
    ).toBeVisible();
    await page.goto("/produits");
    await expect(page.getByRole("link", { name: "execution-sandbox" })).toBeVisible();
  });
});

test.describe("FR-08 : aucune requête tierce", () => {
  test("a product page makes no request outside the local origin", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      if (EXTERNAL_PREFIX.test(request.url())) external.push(request.url());
    });
    await page.goto(SAMPLE_PRODUCT);
    await page.waitForLoadState("networkidle");
    expect(external).toEqual([]);
  });
});

test.describe("FR-09 : liens sortants signalés et sécurisés", () => {
  test("every external link carries rel noopener noreferrer", async ({ page }) => {
    await page.goto(SAMPLE_PRODUCT);
    const links = page.locator('a[href^="https://"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(links.nth(index)).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});

test.describe("FR-10 : fiche retirée avec sa trace", () => {
  // Not applicable yet: no withdrawn product exists in the authority's cards.
  test.fixme("a withdrawn card shows its date and a link to the journal", async () => {});
});

test.describe("FR-11 : sitemap, robots, Atom et corpus identiques", () => {
  test("every sitemap URL answers 200 and the sitemap matches the rendered pages", async ({
    request,
  }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? "");
    expect(urls.length).toBeGreaterThan(8);
    for (const url of urls) {
      const response = await request.get(url.replace(LOCAL_ORIGIN, ""));
      expect(response.status(), url).toBe(200);
    }
  });

  test("robots.txt points to the sitemap and atom.xml lists the product pages", async ({
    request,
  }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap:");
    const atom = await (await request.get("/atom.xml")).text();
    expect(atom).toContain(`<link rel="alternate" href="${LOCAL_ORIGIN}${SAMPLE_PRODUCT}"/>`);
  });
});

test.describe("FR-12 : URL canonique et citation exportable", () => {
  test("a product page declares its canonical URL and a citation with date and source", async ({
    page,
  }) => {
    await page.goto(SAMPLE_PRODUCT);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${LOCAL_ORIGIN}${SAMPLE_PRODUCT}`,
    );
    await expect(page.getByText("Libre AI", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Vérifié le \d{4}-\d{2}-\d{2}/)).toBeVisible();
  });

  test("the citation export answers 200 in plain text", async ({ request }) => {
    const response = await request.get(`${SAMPLE_PRODUCT}/citation.txt`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/Vérifié le \d{4}-\d{2}-\d{2}/);
  });
});

test.describe("G6 : aucun défilement horizontal à 360, 390 et 1440 px", () => {
  for (const width of [360, 390, 1440]) {
    test(`no horizontal scroll at ${width} px on the home, list and a product page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/produits", SAMPLE_PRODUCT]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
