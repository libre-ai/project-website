/**
 * Fixed pages (FR-07): the eight routes whose body does not depend on one card.
 * An unknown path throws instead of rendering an empty page.
 */
import { constellationOf } from "../constellation";
import { deployBody } from "../deploy";
import type { PublicBrandCopy, PublicProof } from "../domain";
import { licencesBody } from "../licences";
import type { Presentation } from "../presentation";
import type { ProjectCard } from "../project-card";
import type { PageExtras } from "./extras";
import { fabriqueBody } from "./fabrique";
import { homeBody } from "./home";
import { FORGE_URL } from "./layout";
import { methodBody } from "./method";
import { offresBody } from "./offres";
import { productList } from "./product";
import { type Proof, proofsBody } from "./proofs";
import { signalerBody } from "./signaler";

export function fixedBody(
  path: string,
  cards: readonly ProjectCard[],
  proofs: readonly Proof[],
  presentations: ReadonlyMap<string, Presentation>,
  brand?: PublicBrandCopy,
  brandProofs?: readonly PublicProof[],
  extras: PageExtras = {},
): { title: string; body: string } {
  switch (path) {
    case "/":
      return { title: "Accueil", body: homeBody(brand, constellationOf(cards)) };
    case "/mission":
      return {
        title: "Mission",
        body: "<h1>Mission</h1><p>Le site a une seule tâche : rendre visible l'état réel de chaque produit, avec sa limite et sa preuve.</p>",
      };
    case "/methode":
      return {
        title: "Méthode",
        body: methodBody(brandProofs),
      };
    case "/produits":
      return {
        title: "Produits",
        body: `<h1>Produits</h1>${productList(cards, presentations)}`,
      };
    case "/offres":
      return { title: "Offres", body: offresBody() };
    case "/deployer":
      return {
        title: "Déployer",
        body:
          extras.deploy === undefined
            ? "<h1>Déployer</h1><p>Aucune donnée de déploiement n'est fournie à cette construction.</p>"
            : deployBody(extras.deploy.facts, extras.deploy.commit),
      };
    case "/licences":
      return {
        title: "Licences",
        body:
          extras.licences === undefined
            ? "<h1>Licences</h1><p>Aucune donnée de licence n'est fournie à cette construction.</p>"
            : licencesBody(extras.licences.rows, extras.licences.commits),
      };
    case "/signaler":
      return { title: "Signaler", body: signalerBody() };
    case "/fabrique":
      return { title: "Fabrique", body: fabriqueBody(cards) };
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
