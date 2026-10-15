/**
 * Proofs page (FR-06): one control's result as printed, what it examined, what it refused,
 * and the command that reproduces it. The numbers come from the gates, never typed here.
 */
import { escapeHtml } from "../security";

export interface Proof {
  readonly gate: string;
  readonly examined: number;
  readonly violations: number;
  readonly command: string;
}

export function proofsBody(proofs: readonly Proof[]): string {
  if (proofs.length === 0) {
    return "<h1>Preuves</h1><p>Aucun résultat de contrôle n'est fourni à cette construction.</p>";
  }
  const rows = proofs
    .map(
      (proof) =>
        `<tr><td data-label="Contrôle">${escapeHtml(proof.gate)}</td><td data-label="Examinés">${proof.examined}</td><td data-label="Violations">${proof.violations}</td><td data-label="Commande"><code>${escapeHtml(proof.command)}</code></td></tr>`,
    )
    .join("");
  return `<h1>Preuves</h1><table><thead><tr><th>Contrôle</th><th>Examinés</th><th>Violations</th><th>Commande</th></tr></thead><tbody>${rows}</tbody></table>`;
}
