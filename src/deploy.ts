/**
 * Deploy page (S3.3, FR-15): what a reader needs to rebuild the code locally, taken from the
 * authority's LOCAL-COMPOSITION.md at a pinned commit. The page cites the revisions that
 * document names, with their full sha, and links to the document at that commit. It runs and
 * deploys nothing, and presents no version as current.
 */
import { escapeHtml } from "./security";

export const DEPLOY_REPOSITORY = "project-governance";
export const DEPLOY_PATH = "docs/LOCAL-COMPOSITION.md";

export interface DeployFacts {
  readonly target: string;
  readonly targetRevision: string;
  readonly toolingRevision: string;
}

const FULL_SHA = /^[0-9a-f]{40}$/;

function constant(text: string, name: string): string {
  const match = text.match(new RegExp(`^${name}=(\\S+)$`, "m"));
  if (match?.[1] === undefined) throw new Error(`deploy.fact_missing:${name}`);
  return match[1];
}

export function parseDeployFacts(text: string): DeployFacts {
  const target = constant(text, "TARGET");
  const targetRevision = constant(text, "TARGET_REVISION");
  const toolingRevision = constant(text, "TOOLING_REVISION");
  for (const [name, value] of [
    ["TARGET_REVISION", targetRevision],
    ["TOOLING_REVISION", toolingRevision],
  ] as const) {
    // A branch name would move under the reader: only a full commit is a citable revision.
    if (!FULL_SHA.test(value)) throw new Error(`deploy.revision_invalid:${name}`);
  }
  return { target, targetRevision, toolingRevision };
}

export function deployBody(facts: DeployFacts, commit: string): string {
  const document = `https://github.com/libre-ai/${DEPLOY_REPOSITORY}/blob/${escapeHtml(commit)}/${DEPLOY_PATH}`;
  return [
    "<h1>Déployer</h1>",
    "<p>Cette page décrit une composition locale : elle prépare un dossier neuf avec les dépôts voisins aux révisions du manifeste, sans rien publier ni déployer sur un service.</p>",
    "<h2>Révisions citées par le document</h2>",
    `<dl class="facts"><dt>Cible</dt><dd>${escapeHtml(facts.target)}</dd><dt>Révision de la cible</dt><dd><code>${escapeHtml(facts.targetRevision)}</code></dd><dt>Révision de l'outillage</dt><dd><code>${escapeHtml(facts.toolingRevision)}</code></dd></dl>`,
    `<p>Ces révisions sont celles que le document nommait au commit épinglé du site. La révision à employer pour un autre travail se choisit dans le dépôt de gouvernance, après revue du manifeste.</p>`,
    `<p><a href="${document}" rel="noopener noreferrer">Lire la recette complète</a> (dépôt de gouvernance, au commit épinglé).</p>`,
  ].join("");
}
