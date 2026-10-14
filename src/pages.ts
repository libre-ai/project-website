/**
 * Page renderer (G1, FR-07, FR-09, FR-12): one HTML document per corpus page.
 * No script element is ever emitted, and every card value passes through
 * escapeHtml. Copy states only what the repository proves.
 */
import { type Corpus, SITE_ORIGIN } from "./corpus";
import { citationFor } from "./feed";
import type { ProjectCard } from "./project-card";
import { escapeHtml } from "./security";

// ADR 0003: exposure and maturity are read and validated, never shown on public pages.
// The state of a project is read in its repository, which every product page links to.
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
    '<header class="site-header"><a class="wordmark" href="/">Libre AI</a><nav><a href="/produits">Produits</a> <a href="/preuves">Preuves</a> <a href="/methode">Méthode</a></nav></header>',
    `<main>${body}</main>`,
    '<footer><a href="/corrections">Journal des corrections</a></footer>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function productItem(card: ProjectCard): string {
  // Each product sits in a square frame; its exposure is an explicit label, never colour alone.
  // ADR 0003: the list names each product and its summary; no state label on public pages.
  return `<li class="frame"><a href="/produits/${escapeHtml(card.project)}">${escapeHtml(card.project)}</a> <span class="summary">${escapeHtml(card.summary)}</span></li>`;
}

function productPage(card: ProjectCard): string {
  const limits = card.limits.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  // A link is rendered only when there is a real URL: an empty href would be a dead control.
  // A link is rendered only when there is a real URL: an empty href would be a dead control.
  const action =
    card.applicationUrl === null
      ? ""
      : `<p><a href="${escapeHtml(card.applicationUrl)}" rel="noopener noreferrer">Ouvrir le produit</a> (application externe)</p>`;
  const sourceUrl = `https://github.com/${escapeHtml(card.repository)}`;
  return [
    `<h1>${escapeHtml(card.project)}</h1>`,
    `<p>${escapeHtml(card.summary)}</p>`,
    `<h2>Situation actuelle</h2><p>${escapeHtml(card.currentSituation)}</p>`,
    `<h2>Limites</h2><ul>${limits}</ul>`,
    action,
    `<p><a href="${sourceUrl}" rel="noopener noreferrer">Code source</a> (dépôt public : l'état détaillé du projet s'y lit)</p>`,
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
        body: '<h1>Possédez la fabrique.</h1><p>Libre AI aide chacun à comprendre, choisir et utiliser l\'IA sans subir les discours marketing ni les dépendances irréversibles.</p><p class="actions"><a href="/produits">Prenez les clés.</a> <a href="/preuves">Voir les preuves.</a></p>',
      };
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
