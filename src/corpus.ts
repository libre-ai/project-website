/**
 * Public corpus (PRD §6, FR-11): the one list of pages the site serves.
 * The sitemap, robots.txt and page set are all derived from it, so they cannot
 * drift apart.
 */
import type { ProjectCard } from "./project-card";

// Local V1 origin (D-J): no public domain until the local recipe is validated.
export const SITE_ORIGIN = "http://localhost:8080";

export type PageKind = "fixed" | "product";

export interface CorpusPage {
  readonly kind: PageKind;
  readonly path: string;
}

export interface Corpus {
  readonly pages: readonly CorpusPage[];
}

const FIXED_PATHS = [
  "/",
  "/mission",
  "/methode",
  "/produits",
  "/fabrique",
  "/preuves",
  "/gouvernance",
  "/corrections",
  "/contribuer",
] as const;

export function buildCorpus(cards: readonly ProjectCard[]): Corpus {
  const fixed: CorpusPage[] = FIXED_PATHS.map((path) => ({ kind: "fixed", path }));
  const products: CorpusPage[] = cards.map((card) => ({
    kind: "product",
    path: `/produits/${card.project}`,
  }));
  return { pages: [...fixed, ...products] };
}

export function renderSitemap(corpus: Corpus): string {
  const entries = corpus.pages
    .map((page) => `  <url><loc>${SITE_ORIGIN}${page.path}</loc></url>`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n");
}

export function renderRobots(): string {
  return ["User-agent: *", "Allow: /", `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, ""].join("\n");
}
