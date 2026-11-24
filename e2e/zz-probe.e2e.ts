import { test } from "@playwright/test";

// TEMPORARY diagnostic, removed before review: measures in Firefox the headings of the large demos
// that the rehearsal reports 2 px too wide at 390 px with the fonts of ADR 0010.
test("probe: large demo headings at 390 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "firefox", "Firefox only");
  await page.setViewportSize({ width: 390, height: 900 });
  for (const slug of ["notes", "wiki", "docs", "diapos", "cours", "sources"]) {
    await page.goto(`/applications/${slug}/`);
    await page.evaluate(() => document.fonts.ready);
    const rows = await page.$$eval("figure.demo-grande b", (elements) =>
      elements.map((b) => {
        const style = getComputedStyle(b);
        const range = document.createRange();
        range.selectNodeContents(b);
        const lines = [...range.getClientRects()].map((r) => Math.round(r.width * 100) / 100);
        const box = b.getBoundingClientRect();
        const measure = () => ({ scroll: b.scrollWidth, client: b.clientWidth });
        const asIs = measure();
        (b as HTMLElement).style.fontFamily = "Georgia, serif";
        const georgia = measure();
        (b as HTMLElement).style.fontFamily = "";
        (b as HTMLElement).style.fontKerning = "none";
        const noKerning = measure();
        (b as HTMLElement).style.fontKerning = "";
        (b as HTMLElement).style.animation = "none";
        const noAnimation = measure();
        (b as HTMLElement).style.animation = "";
        return {
          text: (b.textContent ?? "").slice(0, 24),
          asIs,
          georgia,
          noKerning,
          noAnimation,
          box: Math.round(box.width * 100) / 100,
          lines,
          family: style.fontFamily,
          weight: style.fontWeight,
          size: style.fontSize,
          display: style.display,
          wrap: style.whiteSpace,
          overflowWrap: style.overflowWrap,
          transform: style.transform,
          padding: style.paddingInline,
          parent: `${(b.parentElement as HTMLElement).className} ${(b.parentElement as HTMLElement).clientWidth}`,
          loaded: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`).join(" | "),
        };
      }),
    );
    console.log(`PROBE ${slug} ${JSON.stringify(rows)}`);
  }
});
