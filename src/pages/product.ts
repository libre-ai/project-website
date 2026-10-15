/**
 * Product pages (FR-04, FR-07): the list item and the page of one product. Every card value
 * passes through escapeHtml. Copy states only what the repository proves (ADR 0003).
 */
import { citationFor } from "../feed";
import type { Presentation } from "../presentation";
import { KIND_LABELS, LAYER_LABELS, type ProjectCard } from "../project-card";
import { escapeHtml } from "../security";

// ADR 0003: a reviewed presentation replaces the card's summary; a draft is never published.
export function published(presentation: Presentation | undefined): Presentation | undefined {
  return presentation?.reviewed ? presentation : undefined;
}

export function productItem(card: ProjectCard, presentation: Presentation | undefined): string {
  // Each product sits in a square frame (open frame, orthogonal joint), with its pitch or summary.
  const lead = published(presentation)?.pitch ?? card.summary;
  return `<li class="frame"><a href="/produits/${escapeHtml(card.project)}">${escapeHtml(card.project)}</a> <span class="summary">${escapeHtml(lead)}</span></li>`;
}

// The opening of a product page: the reviewed presentation when there is one, else the card.
function productLead(card: ProjectCard, presentation: Presentation | undefined): string {
  const ready = published(presentation);
  if (ready === undefined) {
    return [
      `<h1>${escapeHtml(card.project)}</h1>`,
      `<p>${escapeHtml(card.summary)}</p>`,
      `<h2>Situation actuelle</h2><p>${escapeHtml(card.currentSituation)}</p>`,
    ].join("");
  }
  const capabilities = ready.capabilities.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  return [
    `<h1>${escapeHtml(ready.title)}</h1>`,
    `<p class="pitch">${escapeHtml(ready.pitch)}</p>`,
    `<h2>Ce qu'il permet</h2><ul>${capabilities}</ul>`,
    `<p>${escapeHtml(ready.audience)}</p>`,
  ].join("");
}

export function productTitle(card: ProjectCard, presentation: Presentation | undefined): string {
  return published(presentation)?.title ?? card.project;
}

// FR-14: place in the constellation. Layer and type only, never a state; a card without
// dependency has no section rather than a claim of none.
function productFacts(card: ProjectCard): string {
  const facts = `<dl class="facts"><dt>Couche</dt><dd>${LAYER_LABELS[card.layer]}</dd><dt>Type</dt><dd>${KIND_LABELS[card.kind]}</dd></dl>`;
  if (card.dependencies.length === 0) return facts;
  const items = card.dependencies
    .map((entry) => `<li>${escapeHtml(entry.on)} : ${escapeHtml(entry.why)}</li>`)
    .join("");
  return `${facts}<h2>Dépendances</h2><ul>${items}</ul>`;
}

export function productPage(card: ProjectCard, presentation: Presentation | undefined): string {
  const limits = card.limits.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  // A link is rendered only when there is a real URL: an empty href would be a dead control.
  const action =
    card.applicationUrl === null
      ? ""
      : `<p><a href="${escapeHtml(card.applicationUrl)}" rel="noopener noreferrer">Ouvrir le produit</a> (application externe)</p>`;
  const sourceUrl = `https://github.com/${escapeHtml(card.repository)}`;
  return [
    productLead(card, presentation),
    productFacts(card),
    `<h2>Limites</h2><ul>${limits}</ul>`,
    action,
    `<p><a href="${sourceUrl}" rel="noopener noreferrer">Code source</a> (dépôt public : l'état détaillé du projet s'y lit)</p>`,
    // The date is kept on one line: a hyphen inside it is not a place to wrap a citation.
    `<h2>Citer</h2><p>${escapeHtml(citationFor(card)).replace(escapeHtml(card.lastVerifiedOn), `<span class="nowrap">${escapeHtml(card.lastVerifiedOn)}</span>`)}</p>`,
  ].join("");
}
