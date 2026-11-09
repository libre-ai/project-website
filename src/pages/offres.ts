/**
 * Offers page (S3.1, FR-15, owner decision D-open-2 of 2026-10-15): five capabilities a reader
 * has over the code, each tied to the page of this site that carries its proof. Nothing is sold,
 * priced or promised free: the page describes what the public repositories allow.
 */
import { escapeHtml } from "../security";

export interface Capability {
  readonly name: string;
  readonly text: string;
  // A route of this site where the capability can be checked.
  readonly proof: string;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    name: "Inspecter",
    text: "Le code de chaque produit est dans un dépôt public ; la fiche de chaque produit renvoie à son code source.",
    proof: "/produits",
  },
  {
    name: "Reproduire",
    text: "Les contrôles de ce site se rejouent par la commande indiquée à côté de chaque résultat.",
    proof: "/preuves",
  },
  {
    name: "Modifier",
    text: "Les licences que chaque dépôt déclare sont listées, avec leur fichier source.",
    proof: "/licences",
  },
  {
    name: "Déployer",
    text: "Une composition locale se prépare à partir de révisions épinglées, sans rien publier.",
    proof: "/deployer",
  },
  {
    name: "Contribuer",
    text: "Les propositions passent par la forge publique, sans compte sur ce site.",
    proof: "/contribuer",
  },
];

export function offresBody(): string {
  const items = CAPABILITIES.map(
    (entry) =>
      `<li class="frame"><strong>${escapeHtml(entry.name)}</strong> <span class="summary">${escapeHtml(entry.text)}</span> <a href="${entry.proof}">Voir la preuve</a></li>`,
  ).join("");
  return `<h1>Offres</h1><p>Cinq capacités ouvertes à qui lit le code. Chacune renvoie à la page qui permet de la vérifier ; aucune n'est vendue.</p><ul>${items}</ul>`;
}
