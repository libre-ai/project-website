/**
 * Visual capture (G10): one full-page screenshot per route template at 390 and 1440 px, from a
 * server already serving dist/ on http://localhost:8080. Captures go to the directory named on
 * the command line; they are not versioned.
 *
 * Usage: bun scripts/capture.ts <output directory>
 */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:8080";
const ROUTES = [
  "/",
  "/mission",
  "/methode",
  "/produits",
  "/preuves",
  "/gouvernance",
  "/corrections",
  "/contribuer",
  "/produits/execution-sandbox",
];
const WIDTHS = [390, 1440];

const outputDirectory = process.argv[2];
if (outputDirectory === undefined || outputDirectory === "") {
  throw new Error("capture.output_directory_not_set");
}

const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`);
      const name = `${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${width}.png`;
      await page.screenshot({ path: `${outputDirectory}/${name}`, fullPage: true });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(
  `G10 captures écrites: ${ROUTES.length * WIDTHS.length} (${ROUTES.length} gabarits × ${WIDTHS.length} largeurs)`,
);
