/**
 * Fixed pages (FR-07): the eight routes whose body does not depend on one card.
 * An unknown path throws instead of rendering an empty page.
 */
import type { PublicBrandCopy } from "../domain";
import type { Presentation } from "../presentation";
import type { ProjectCard } from "../project-card";
import { homeBody } from "./home";
import { FORGE_URL } from "./layout";
import { productItem } from "./product";
import { type Proof, proofsBody } from "./proofs";

export function fixedBody(
  path: string,
  cards: readonly ProjectCard[],
  proofs: readonly Proof[],
  presentations: ReadonlyMap<string, Presentation>,
  brand?: PublicBrandCopy,
): { title: string; body: string } {
  switch (path) {
    case "/":
      return { title: "Accueil", body: homeBody(brand) };
    case "/mission":
      return {
        title: "Mission",
        body: "<h1>Mission</h1><p>Le site a une seule tâche : rendre visible l'état réel de chaque produit, avec sa limite et sa preuve.</p>",
      };
    case "/methode":
      return {
        title: "Méthode",
        body: "<h1>Méthode</h1><p>Chaque produit est décrit avec ses limites, la date de sa vérification et son code source. L'état détaillé de chaque projet se lit dans son dépôt. Les contrôles du dépôt échouent sur une source illisible au lieu de passer.</p>",
      };
    case "/produits":
      return {
        title: "Produits",
        body: `<h1>Produits</h1><ul>${cards.map((card) => productItem(card, presentations.get(card.project))).join("")}</ul>`,
      };
    case "/preuves":
      return {
        title: "Preuves",
        body: proofsBody(proofs),
      };
    case "/gouvernance":
      return {
        title: "Gouvernance",
        body: `<h1>Gouvernance</h1><p>Les décisions et les rôles sont tenus dans le dépôt de gouvernance, <a href="${FORGE_URL}/project-governance" rel="noopener noreferrer"><span class="nowrap">project-governance</span></a>.</p>`,
      };
    case "/corrections":
      return {
        title: "Corrections",
        body: "<h1>Journal des corrections</h1><p>Aucune correction publiée à ce jour.</p>",
      };
    case "/contribuer":
      return {
        title: "Contribuer",
        body: `<h1>Contribuer</h1><p>Les propositions passent par la forge publique : <a href="${FORGE_URL}" rel="noopener noreferrer">${FORGE_URL}</a>.</p>`,
      };
    default:
      throw new Error(`pages.route_unknown:${path}`);
  }
}
