/**
 * Machine-readable projections of the corpus (FR-11, FR-12): an Atom feed of
 * the product pages and a citation for each product. Both read the same corpus
 * and the same card fields as the pages.
 */
import { type Corpus, SITE_ORIGIN } from "./corpus";
import type { ProjectCard } from "./project-card";
import { escapeHtml } from "./security";

// The author of record is the organisation that maintains the corpus: the card
// schema names no individual author, and this site does not invent one.
const AUTHOR = "Libre AI";

function atomInstant(day: string): string {
  return `${day}T00:00:00Z`;
}

export function citationFor(card: ProjectCard): string {
  // ADR 0003: the citation names author, verification date and source; it carries no state.
  return `${AUTHOR}. « ${card.project} ». Vérifié le ${card.lastVerifiedOn}. ${SITE_ORIGIN}/produits/${card.project}`;
}

export function renderAtom(corpus: Corpus, cards: readonly ProjectCard[]): string {
  const byRoute = new Map(cards.map((card) => [`/produits/${card.project}`, card]));
  const productPages = corpus.pages.filter((page) => page.kind === "product");
  const entries = productPages.map((page) => {
    const card = byRoute.get(page.path);
    if (card === undefined) throw new Error(`feed.card_missing:${page.path}`);
    const url = `${SITE_ORIGIN}${page.path}`;
    return [
      "  <entry>",
      `    <id>${escapeHtml(url)}</id>`,
      `    <title>${escapeHtml(card.project)}</title>`,
      `    <link rel="alternate" href="${escapeHtml(url)}"/>`,
      `    <updated>${atomInstant(card.lastVerifiedOn)}</updated>`,
      `    <author><name>${AUTHOR}</name></author>`,
      "  </entry>",
    ].join("\n");
  });
  // The feed is as fresh as its freshest entry; an empty feed has no date to claim.
  const latest = cards
    .map((card) => card.lastVerifiedOn)
    .sort()
    .at(-1);
  if (latest === undefined) throw new Error("feed.no_entries");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${SITE_ORIGIN}/</id>`,
    "  <title>Libre AI : produits</title>",
    `  <updated>${atomInstant(latest)}</updated>`,
    `  <link rel="self" href="${SITE_ORIGIN}/atom.xml"/>`,
    ...entries,
    "</feed>",
    "",
  ].join("\n");
}
