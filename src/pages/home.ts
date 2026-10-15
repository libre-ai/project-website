/**
 * Home page (O2, FR-13): the brand copy is read from the governance projection and rendered
 * field by field. Nothing is typed here: without a projection the page names the site only,
 * and the build entry point refuses to run without one.
 */
import type { PublicBrandCopy } from "../domain";
import { escapeHtml } from "../security";

export function homeBody(brand: PublicBrandCopy | undefined): string {
  if (brand === undefined) return "<h1>Libre AI</h1>";
  return [
    `<h1>${escapeHtml(brand.promise)}</h1>`,
    `<p class="tension">${escapeHtml(brand.tension)}</p>`,
    `<p>${escapeHtml(brand.explanation)}</p>`,
    `<p class="qualification">${escapeHtml(brand.qualification)}</p>`,
    `<p>${escapeHtml(brand.reasonToBelieve)}</p>`,
    `<p class="actions"><a href="/produits">${escapeHtml(brand.primaryCta)}</a> <a href="/preuves">${escapeHtml(brand.secondaryCta)}</a></p>`,
  ].join("");
}
