/**
 * Site assembly (G1 to G4, G9): loads the card source, renders the corpus, runs
 * every gate, and returns the output files with the counters of each gate.
 * Any gate violation refuses the whole build: a partial site is never emitted.
 */
import { checkForbiddenClaims } from "./claims";
import { buildCorpus, renderRobots, renderSitemap } from "./corpus";
import { renderPages } from "./pages";
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
}

const CARD_SUFFIX = ".project.v1.yaml";

// Output path of a corpus route: a directory index, so /produits/x serves produits/x/index.html.
function outputPath(route: string): string {
  return route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
}

export function buildSite(sources: readonly SourceFile[]): SiteResult {
  const cardSources = sources.filter((source) => source.name.endsWith(CARD_SUFFIX));
  if (cardSources.length === 0) throw new Error("cards.source_empty");

  const cards: ProjectCard[] = cardSources.map((source) =>
    parseProjectCard(Bun.YAML.parse(source.text)),
  );
  const cardGates = checkProjectCardGates(cards);
  const resources: Resource[] = [];
  const resourceGates = checkResourceGates(resources);

  const corpus = buildCorpus(cards);
  const pages = renderPages(corpus, cards);
  const texts = [...pages].map(([path, html]) => ({ id: path, text: html }));
  const claimGates = checkForbiddenClaims(texts);

  const violations = [
    ...cardGates.violations,
    ...resourceGates.violations,
    ...claimGates.violations,
  ];
  if (violations.length > 0) throw new Error(`site.gate_refused:${violations.join(",")}`);

  const files = new Map<string, string>();
  for (const [route, html] of pages) files.set(outputPath(route), html);
  files.set("sitemap.xml", renderSitemap(corpus));
  files.set("robots.txt", renderRobots());

  const productPages = corpus.pages.filter((page) => page.kind === "product").length;
  return {
    files,
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
