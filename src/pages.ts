/**
 * Page renderer (G1, FR-07, FR-09, FR-12): one HTML document per corpus page.
 * No script element is ever emitted, and every card value passes through
 * escapeHtml. Copy states only what the repository proves.
 */
import { type Corpus, SITE_ORIGIN } from "./corpus";
import { citationFor } from "./feed";
import type { Exposure, Maturity, ProjectCard } from "./project-card";
import { escapeHtml } from "./security";

const EXPOSURE_LABELS: Readonly<Record<Exposure, string>> = {
  idea: "Idée",
  "spec-published": "Spécification publiée",
  "usable-verifiable": "Utilisable et vérifiable",
  proven: "Éprouvé",
};

const MATURITY_LABELS: Readonly<Record<Maturity, string>> = {
  idea: "Idée",
  specified: "Spécifié",
  usable: "Utilisable",
  proven: "Éprouvé",
};

// Exposures whose application URL may be shown (FR-02). Others get a follow link only.
const EXPOSURES_WITH_APPLICATION: readonly Exposure[] = ["usable-verifiable", "proven"];

const FORGE_URL = "https://github.com/libre-ai";

function layout(title: string, path: string, body: string): string {
  const canonical = `${SITE_ORIGIN}${path}`;
  return [
    "<!doctype html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)} · Libre AI</title>`,
    `<link rel="canonical" href="${canonical}">`,
    '<link rel="alternate" type="application/atom+xml" href="/atom.xml">',
    '<link rel="stylesheet" href="/assets/tokens.css">',
    '<link rel="stylesheet" href="/assets/styles.css">',
    "</head>",
    "<body>",
    '<header><a href="/">Libre AI</a></header>',
    `<main>${body}</main>`,
    '<footer><a href="/corrections">Journal des corrections</a></footer>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function productItem(card: ProjectCard): string {
  return `<li><a href="/produits/${escapeHtml(card.project)}">${escapeHtml(card.project)}</a> : ${escapeHtml(EXPOSURE_LABELS[card.exposure])}</li>`;
}

function productPage(card: ProjectCard): string {
  const limits = card.limits.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  // A link is rendered only when there is a real URL: an empty href would be a dead control.
  let action = "<p>Suivre la fiche sur la forge.</p>";
  if (EXPOSURES_WITH_APPLICATION.includes(card.exposure)) {
    action =
      card.applicationUrl === null
        ? "<p>Adresse applicative non publiée.</p>"
        : `<p><a href="${escapeHtml(card.applicationUrl)}" rel="noopener noreferrer">Ouvrir le produit</a> (application externe)</p>`;
  }
  return [
    `<h1>${escapeHtml(card.project)}</h1>`,
    `<p>${escapeHtml(card.summary)}</p>`,
    `<p>Exposition : ${escapeHtml(EXPOSURE_LABELS[card.exposure])}. Maturité : ${escapeHtml(MATURITY_LABELS[card.maturity])}.</p>`,
    `<h2>Situation actuelle</h2><p>${escapeHtml(card.currentSituation)}</p>`,
    `<h2>Limites</h2><ul>${limits}</ul>`,
    action,
    `<p><a href="${FORGE_URL}" rel="noopener noreferrer">Forge publique</a></p>`,
    // The date is kept on one line: a hyphen inside it is not a place to wrap a citation.
    `<h2>Citer</h2><p>${escapeHtml(citationFor(card)).replace(escapeHtml(card.lastVerifiedOn), `<span class="nowrap">${escapeHtml(card.lastVerifiedOn)}</span>`)}</p>`,
  ].join("");
}

// One control's result as printed on the proofs page: what it examined, what it refused, and
// the command that reproduces it (FR-06). The numbers come from the gates, never typed here.
export interface Proof {
  readonly gate: string;
  readonly examined: number;
  readonly violations: number;
  readonly command: string;
}

function proofsBody(proofs: readonly Proof[]): string {
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

function fixedBody(
  path: string,
  cards: readonly ProjectCard[],
  proofs: readonly Proof[],
): { title: string; body: string } {
  switch (path) {
    case "/":
      return {
        title: "Accueil",
        body: '<h1>Possédez la fabrique.</h1><p>Libre AI aide chacun à comprendre, choisir et utiliser l\'IA sans subir les discours marketing ni les dépendances irréversibles.</p><p><a href="/produits">Voir les produits</a></p>',
      };
    case "/mission":
      return {
        title: "Mission",
        body: "<h1>Mission</h1><p>Le site a une seule tâche : rendre visible l'état réel de chaque produit, avec sa limite et sa preuve.</p>",
      };
    case "/methode":
      return {
        title: "Méthode",
        body: "<h1>Méthode</h1><p>Chaque affirmation sur un produit porte son état, ses limites et la date de sa vérification. Les contrôles du dépôt échouent sur une source illisible au lieu de passer.</p>",
      };
    case "/produits":
      return {
        title: "Produits",
        body: `<h1>Produits</h1><ul>${cards.map(productItem).join("")}</ul>`,
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

export function renderPages(
  corpus: Corpus,
  cards: readonly ProjectCard[],
  proofs: readonly Proof[] = [],
): ReadonlyMap<string, string> {
  const pages = new Map<string, string>();
  for (const page of corpus.pages) {
    if (page.kind === "fixed") {
      const { title, body } = fixedBody(page.path, cards, proofs);
      pages.set(page.path, layout(title, page.path, body));
      continue;
    }
    const card = cards.find((entry) => `/produits/${entry.project}` === page.path);
    if (card === undefined) throw new Error(`pages.card_missing:${page.path}`);
    pages.set(page.path, layout(card.project, page.path, productPage(card)));
  }
  return pages;
}
