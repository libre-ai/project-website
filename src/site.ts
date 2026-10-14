/**
 * Site assembly (G1 to G4, G9): loads the card source, renders the corpus, runs
 * every gate, and returns the output files with the counters of each gate.
 * Any gate violation refuses the whole build: a partial site is never emitted.
 */
import { checkForbiddenClaims } from "./claims";
import { buildCorpus, renderRobots, renderSitemap } from "./corpus";
import { citationFor, renderAtom } from "./feed";
import { type Proof, renderPages } from "./pages";
import { checkProjectCardGates, type ProjectCard, parseProjectCard } from "./project-card";
import { checkResourceGates, type Resource } from "./resource";

export interface SourceFile {
  readonly name: string;
  readonly text: string;
}

export interface SiteReport {
  readonly cardsRead: number;
  readonly productPages: number;
  readonly fixedPages: number;
  readonly resourcesExamined: number;
  readonly textsExamined: number;
  readonly claimViolations: number;
}

export interface SiteResult {
  readonly files: ReadonlyMap<string, string>;
  readonly report: SiteReport;
  // Project names as the cards declare them, for the universe check in the entry point.
  readonly projects: readonly string[];
}

const CARD_SUFFIX = ".project.v1.yaml";

// Output path of a corpus route: a directory index, so /produits/x serves produits/x/index.html.
function outputPath(route: string): string {
  return route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
}

// The stylesheets are supplied by the caller: the build reads them from the pinned UI
// package, so this module stays free of file-system access and remains testable.
export interface SiteAssets {
  readonly tokens: string;
  readonly styles: string;
}

export function buildSite(sources: readonly SourceFile[], assets: SiteAssets): SiteResult {
  const cardSources = sources.filter((source) => source.name.endsWith(CARD_SUFFIX));
  if (cardSources.length === 0) throw new Error("cards.source_empty");

  const cards: ProjectCard[] = cardSources.map((source) =>
    parseProjectCard(Bun.YAML.parse(source.text)),
  );
  const cardGates = checkProjectCardGates(cards);
  const resources: Resource[] = [];
  const resourceGates = checkResourceGates(resources);

  const corpus = buildCorpus(cards);
  // The proofs page is generated from the gates' own counters, so the claim gate scans the
  // other pages only: it holds machine output, never authored copy, and scanning it would be circular.
  const draftPages = renderPages(corpus, cards);
  const texts = [...draftPages]
    .filter(([path]) => path !== "/preuves")
    .map(([path, html]) => ({ id: path, text: html }));
  const claimGates = checkForbiddenClaims(texts);

  const violations = [
    ...cardGates.violations,
    ...resourceGates.violations,
    ...claimGates.violations,
  ];
  if (violations.length > 0) throw new Error(`site.gate_refused:${violations.join(",")}`);

  // One row per gate, each taken from that gate's own result; the command is the one that reproduces it.
  const command = "LIBRE_AI_CARDS_DIR=<dossier des fiches> bun run build";
  const proofs: Proof[] = [
    { gate: "G2 fiches lues", examined: cards.length, violations: 0, command },
    { gate: "G3 ressources examinées", examined: resourceGates.examined, violations: 0, command },
    {
      gate: "G9 textes examinés",
      examined: claimGates.examined,
      violations: claimGates.violations.length,
      command,
    },
  ];
  const pages = renderPages(corpus, cards, proofs);

  const files = new Map<string, string>();
  for (const [route, html] of pages) files.set(outputPath(route), html);
  files.set("sitemap.xml", renderSitemap(corpus));
  files.set("robots.txt", renderRobots());
  files.set("assets/tokens.css", assets.tokens);
  files.set("assets/styles.css", assets.styles);
  files.set("atom.xml", renderAtom(corpus, cards));
  // A citation is exported next to its product page, as plain text a reader can copy.
  for (const card of cards)
    files.set(`produits/${card.project}/citation.txt`, `${citationFor(card)}\n`);

  const productPages = corpus.pages.filter((page) => page.kind === "product").length;
  return {
    files,
    projects: cards.map((card) => card.project),
    report: {
      cardsRead: cards.length,
      productPages,
      fixedPages: corpus.pages.length - productPages,
      resourcesExamined: resourceGates.examined,
      textsExamined: claimGates.examined,
      claimViolations: claimGates.violations.length,
    },
  };
}
