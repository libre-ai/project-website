/**
 * Shared page frame (G1, FR-09): the document shell every page uses. No script element is
 * ever emitted; the title passes through escapeHtml.
 */
import { SITE_ORIGIN } from "../corpus";
import { escapeHtml } from "../security";

// ADR 0003: exposure and maturity are read and validated, never shown on public pages.
// The state of a project is read in its repository, which every product page links to.
export const FORGE_URL = "https://github.com/libre-ai";

interface Entry {
  readonly href: string;
  readonly label: string;
}

const NAVIGATION: readonly Entry[] = [
  { href: "/produits", label: "Produits" },
  { href: "/fabrique", label: "Fabrique" },
  { href: "/offres", label: "Offres" },
  { href: "/preuves", label: "Preuves" },
  { href: "/methode", label: "Méthode" },
];

const CORRECTIONS = "/corrections";

const FOOTER: readonly Entry[] = [
  { href: CORRECTIONS, label: "Journal des corrections" },
  { href: "/deployer", label: "Déployer" },
  { href: "/licences", label: "Licences" },
  { href: "/signaler", label: "Signaler" },
];

// Entries are joined by a space so the text reads as separate words without styles.
function links(entries: readonly Entry[]): string {
  return entries.map((entry) => `<a href="${entry.href}">${entry.label}</a>`).join(" ");
}

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
    `<header class="site-header"><a class="wordmark" href="/">Libre AI</a><nav>${links(NAVIGATION)}</nav></header>`,
    `<main>${body}</main>`,
    // A page does not link to itself: the footer omits the entry of the current page, except the
    // corrections journal, which FR-05 requires in the footer of every page, its own included.
    `<footer>${links(FOOTER.filter((entry) => entry.href !== path || entry.href === CORRECTIONS))}</footer>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
