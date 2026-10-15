/**
 * Page renderer (G1, FR-07, FR-09, FR-12): one HTML document per corpus page.
 * Assembler only: the families live under `pages/` so parallel work does not collide.
 */
import type { Corpus } from "./corpus";
import type { PageOptions } from "./pages/extras";
import { fixedBody } from "./pages/fixed";
import { layout } from "./pages/layout";
import { productPage, productTitle } from "./pages/product";
import type { Presentation } from "./presentation";
import type { ProjectCard } from "./project-card";

export type { Proof } from "./pages/proofs";

export function renderPages(
  corpus: Corpus,
  cards: readonly ProjectCard[],
  options: PageOptions = {},
): ReadonlyMap<string, string> {
  const presentations = options.presentations ?? new Map<string, Presentation>();
  const pages = new Map<string, string>();
  for (const page of corpus.pages) {
    if (page.kind === "fixed") {
      const { title, body } = fixedBody(page.path, cards, options);
      pages.set(page.path, layout(title, page.path, body));
      continue;
    }
    const card = cards.find((entry) => `/produits/${entry.project}` === page.path);
    if (card === undefined) throw new Error(`pages.card_missing:${page.path}`);
    const presentation = presentations.get(card.project);
    pages.set(
      page.path,
      layout(productTitle(card, presentation), page.path, productPage(card, presentation)),
    );
  }
  return pages;
}
