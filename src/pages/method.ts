/**
 * Method page (S1.2, FR-13): the method of the site, then each affirmation of the brand platform
 * with its mechanism, its limit, its verification date and its source. The affirmations are read
 * from the governance projection; without one the section is absent, so nothing is claimed.
 */
import type { PublicProof } from "../domain";
import { escapeHtml } from "../security";

const INTRO =
  "<p>Chaque produit est décrit avec ses limites, la date de sa vérification et son code source. L'état détaillé de chaque projet se lit dans son dépôt. Les contrôles du dépôt échouent sur une source illisible au lieu de passer.</p>";

function proofItem(proof: PublicProof): string {
  return [
    "<li>",
    `<strong>${escapeHtml(proof.claim)}</strong>`,
    `<p>${escapeHtml(proof.mechanism)}</p>`,
    `<p>Limite : ${escapeHtml(proof.limitation)}</p>`,
    // The date stays on one line; the source is the page a reader checks the affirmation against.
    `<p>Vérifié le <span class="nowrap">${escapeHtml(proof.verifiedOn)}</span> · <a href="${escapeHtml(proof.source)}" rel="noopener noreferrer">Source</a></p>`,
    "</li>",
  ].join("");
}

export function methodBody(proofs: readonly PublicProof[] | undefined): string {
  if (proofs === undefined || proofs.length === 0) return `<h1>Méthode</h1>${INTRO}`;
  return `<h1>Méthode</h1>${INTRO}<h2>Ce que le site affirme, et sa limite</h2><ul>${proofs.map(proofItem).join("")}</ul>`;
}
