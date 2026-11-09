/**
 * Factory page (S3.4, FR-15): the constellation as a table, layer by product, generated from
 * the cards. Layer, type and repository only: no state column, no filter (ADR 0003).
 */
import { KIND_LABELS, LAYER_LABELS, type ProjectCard } from "../project-card";
import { escapeHtml } from "../security";

export function fabriqueBody(cards: readonly ProjectCard[]): string {
  const layers = Object.keys(LAYER_LABELS) as (keyof typeof LAYER_LABELS)[];
  const rows = layers
    .flatMap((layer) => cards.filter((card) => card.layer === layer))
    .map(
      (card) =>
        `<tr><td data-label="Couche">${LAYER_LABELS[card.layer]}</td><td data-label="Produit"><a href="/produits/${escapeHtml(card.project)}">${escapeHtml(card.project)}</a></td><td data-label="Type">${KIND_LABELS[card.kind]}</td><td data-label="Dépôt"><a href="https://github.com/${escapeHtml(card.repository)}" rel="noopener noreferrer">${escapeHtml(card.repository)}</a></td></tr>`,
    )
    .join("");
  return `<h1>Fabrique</h1><p>Les couches de la constellation et les dépôts qui les portent, lus dans les fiches de projet.</p><table><thead><tr><th>Couche</th><th>Produit</th><th>Type</th><th>Dépôt</th></tr></thead><tbody>${rows}</tbody></table>`;
}
