/**
 * Shared page frame (G1, FR-09): the document shell every page uses. No script element is
 * ever emitted; the title passes through escapeHtml.
 */
import { SITE_ORIGIN } from "../corpus";
import { escapeHtml } from "../security";

// ADR 0003: exposure and maturity are read and validated, never shown on public pages.
// The state of a project is read in its repository, which every product page links to.
export const FORGE_URL = "https://github.com/libre-ai";

export function layout(title: string, path: string, body: string): string {
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
    '<header class="site-header"><a class="wordmark" href="/">Libre AI</a><nav><a href="/produits">Produits</a> <a href="/fabrique">Fabrique</a> <a href="/preuves">Preuves</a> <a href="/methode">Méthode</a></nav></header>',
    `<main>${body}</main>`,
    '<footer><a href="/corrections">Journal des corrections</a> <a href="/licences">Licences</a> <a href="/signaler">Signaler</a></footer>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
