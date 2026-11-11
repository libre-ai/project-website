/**
 * Assembly of the Libre IA site (plan, Task 9): pages from the route table, the forge pages from
 * the verified cards, the minified stylesheet with the hoisted demo rules, the client bundles, the
 * sprite, the favicon, the fonts, the sitemap and robots. Every gate reports what it examined and
 * any violation refuses the build. The proofs page is rendered from the gates' own counters, so
 * the text gates scan the other pages only: scanning it would be circular.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAVICON_PATH, renderFavicon, renderSprite, SPRITE_PATH } from "../brand/sprite";
import { checkAssetBudgets, checkBudget } from "../budget";
import { checkForbiddenClaims } from "../claims";
import { deployBody } from "../deploy";
import { renderStylesheet } from "../design/stylesheet";
import { licencesBody } from "../licences";
import { SITE_ORIGIN } from "../origin";
import type { PageExtras } from "../pages/extras";
import { productPage, productTitle, published } from "../pages/product";
import { type Proof, proofsBody } from "../pages/proofs";
import { signalerBody } from "../pages/signaler";
import type { Presentation } from "../presentation";
import { checkProjectCardGates, type ProjectCard } from "../project-card";
import { checkResourceGates } from "../resource";
import { checkCopy, checkInternalLinks, findInlineStyles } from "./gates";
import { type ForgeInput, libreRoutes, type Route, renderRoute } from "./routes";
import { hoistedContentCss } from "./sections";

export { SITE_ORIGIN };

export interface LibreSiteInput {
  readonly cards: readonly ProjectCard[];
  readonly presentations: readonly Presentation[];
  readonly extras: PageExtras;
  /** Gates the entry point ran before this assembly (snapshot, licences, deploy). */
  readonly priorProofs: readonly Proof[];
  /** Font files and their licences, read from the pinned packages by the entry point. */
  readonly fonts: ReadonlyMap<string, Uint8Array>;
}

export interface LibreSiteReport {
  readonly pages: number;
  readonly bricks: number;
  readonly inlineStyles: { readonly examined: number; readonly violations: number };
  readonly copy: {
    readonly examined: number;
    readonly violations: number;
    readonly forgeQuoted: number;
  };
  readonly claims: { readonly examined: number; readonly violations: number };
  readonly links: { readonly examined: number; readonly broken: number };
  readonly budget: {
    readonly examined: number;
    readonly heaviest: string;
    readonly gzipBytes: number;
    readonly violations: number;
  };
  readonly assets: { readonly examined: number; readonly violations: number };
  readonly bytes: Readonly<Record<"script" | "stylesheet" | "sprite", number>>;
}

const COMMAND = "bun run build";
const CORRECTIONS = "<h1>Journal des corrections</h1><p>Aucune correction publiée à ce jour.</p>";

function forgeInput(input: LibreSiteInput, proofs: readonly Proof[]): ForgeInput {
  const presentations = new Map(input.presentations.map((entry) => [entry.project, entry]));
  const { licences, deploy } = input.extras;
  return {
    bricks: input.cards.map((card) => {
      const presentation = presentations.get(card.project);
      return {
        project: card.project,
        title: productTitle(card, presentation),
        lead: published(presentation)?.pitch ?? card.summary,
        body: productPage(card, presentation),
      };
    }),
    proofs: proofsBody(proofs),
    licences:
      licences === undefined
        ? "<h1>Licences</h1><p>Aucune donnée de licence n'est fournie à cette construction.</p>"
        : licencesBody(licences.rows, licences.commits),
    deploy:
      deploy === undefined
        ? "<h1>Déployer</h1><p>Aucune donnée de déploiement n'est fournie à cette construction.</p>"
        : deployBody(deploy.facts, deploy.commit),
    signal: signalerBody(),
    corrections: CORRECTIONS,
  };
}

/**
 * Bundles and minifies one entry with `bun build` in a child process. In-process `Bun.build`
 * fails to resolve relative imports when called from the test runner (measured on Bun
 * 1.4.0-canary.1); the child process resolves them as the command line does, in tests and builds.
 */
async function bundle(entry: string, external: readonly string[] = []): Promise<string> {
  const child = Bun.spawnSync(
    [
      process.execPath,
      "build",
      entry,
      "--target=browser",
      "--minify",
      ...external.flatMap((pattern) => ["--external", pattern]),
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (child.exitCode !== 0) {
    throw new Error(`site.bundle_failed:${entry}:${child.stderr.toString().trim()}`);
  }
  return child.stdout.toString();
}

/** Minifies a stylesheet through Bun's CSS bundler, which keeps :has(), mod() and nested rules. */
async function minifyCss(css: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "libre-ia-css-"));
  try {
    const path = join(directory, "site.css");
    await writeFile(path, css, "utf8");
    // Font URLs point at files the build writes next to the sheet: kept as they are.
    return await bundle(path, ["/assets/*"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function sitemap(routes: readonly Route[]): string {
  const urls = routes
    .filter((entry) => entry.kind === "page" || entry.kind === "forge")
    .map((entry) => `  <url><loc>${SITE_ORIGIN}${entry.path}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

const robots = (): string => `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;

const size = (text: string): number => new TextEncoder().encode(text).length;

export async function buildLibreSite(
  input: LibreSiteInput,
): Promise<{ readonly files: Map<string, string | Uint8Array>; readonly report: LibreSiteReport }> {
  // Gates on the inputs: each card and each presentation, and no presentation without a card.
  const cardGates = checkProjectCardGates(input.cards);
  const resourceGates = checkResourceGates([...input.presentations]);
  const projects = new Set(input.cards.map((card) => card.project));
  const orphans = input.presentations
    .filter((presentation) => !projects.has(presentation.project))
    .map((presentation) => `presentation.unknown_project:${presentation.project}`);

  // A first rendering, the proofs page left empty, feeds the text gates.
  const draftRoutes = libreRoutes(forgeInput(input, []));
  const draftEntries = draftRoutes.filter((entry) => entry.path !== "/preuves/");
  const draft = draftEntries.map((entry) => ({ page: entry.path, html: renderRoute(entry) }));
  const inlineStyles = draft.flatMap(({ page, html }) =>
    findInlineStyles(html).map((found) => `style.inline:${page}:${found.trim()}`),
  );
  // The wording rules of ADR 0007 hold the site's own copy. Forge pages quote the pinned records
  // of each repository verbatim (« 24 dépôts » in a summary is the authority's text, not ours):
  // they stay under G9 and the style gate, and their number is reported, never hidden.
  const forgePaths = new Set(
    draftEntries.filter((entry) => entry.kind === "forge").map((entry) => entry.path),
  );
  const copy = checkCopy(draft.filter(({ page }) => !forgePaths.has(page)));
  const claims = checkForbiddenClaims(draft.map(({ page, html }) => ({ id: page, text: html })));
  const violations = [
    ...cardGates.violations,
    ...resourceGates.violations,
    ...orphans,
    ...inlineStyles,
    ...copy.violations,
    ...claims.violations,
  ];
  if (violations.length > 0) throw new Error(`site.gate_refused:${violations.join(",")}`);

  const reviewed = input.presentations.filter((entry) => entry.reviewed).length;
  const proofs: Proof[] = [
    ...input.priorProofs,
    { gate: "G2 fiches lues", examined: input.cards.length, violations: 0, command: COMMAND },
    {
      gate: "G3 ressources examinées",
      examined: resourceGates.examined,
      violations: 0,
      command: COMMAND,
    },
    {
      gate: `Présentations relues : ${reviewed} sur ${input.presentations.length}`,
      examined: input.presentations.length,
      violations: 0,
      command: COMMAND,
    },
    { gate: "G9 textes examinés", examined: claims.examined, violations: 0, command: COMMAND },
    { gate: "ADR 0005 styles en ligne", examined: draft.length, violations: 0, command: COMMAND },
    {
      gate: `ADR 0007 formulations et compteurs (pages de forge citées telles quelles : ${forgePaths.size})`,
      examined: copy.examined,
      violations: 0,
      command: COMMAND,
    },
  ];

  const routes = libreRoutes(forgeInput(input, proofs));
  const files = new Map<string, string | Uint8Array>();
  for (const entry of routes) files.set(entry.file, renderRoute(entry));

  const stylesheet = await minifyCss(`${await renderStylesheet()}\n${hoistedContentCss()}\n`);
  const script = await bundle(join(import.meta.dir, "../client/dom/main.ts"));
  const themeInit = await bundle(join(import.meta.dir, "../client/dom/theme-init.ts"));
  const sprite = renderSprite();
  files.set("assets/site.css", stylesheet);
  files.set("assets/main.js", script);
  files.set("assets/theme-init.js", themeInit);
  files.set(SPRITE_PATH, sprite);
  files.set(FAVICON_PATH, renderFavicon());
  for (const [path, bytes] of input.fonts) files.set(path, bytes);
  files.set("sitemap.xml", sitemap(routes));
  files.set("robots.txt", robots());

  // Links and weights are measured on the written files, then the proofs page is rendered again
  // with those counters, and the measure is taken once more on the final files.
  const measure = () => ({
    links: checkInternalLinks(files),
    budget: checkBudget(files),
    assets: checkAssetBudgets(files),
  });
  const first = measure();
  const lateProofs: Proof[] = [
    ...proofs,
    {
      gate: "Liens internes et références de fichiers",
      examined: first.links.examined,
      violations: first.links.broken.length,
      command: COMMAND,
    },
    {
      gate: "Poids transféré par page (gzip)",
      examined: first.budget.examined,
      violations: first.budget.violations.length,
      command: COMMAND,
    },
    {
      gate: "Poids du script, de la feuille et du sprite",
      examined: first.assets.examined,
      violations: first.assets.violations.length,
      command: COMMAND,
    },
  ];
  const proofsRoute = libreRoutes(forgeInput(input, lateProofs)).find(
    (entry) => entry.path === "/preuves/",
  );
  if (proofsRoute === undefined) throw new Error("site.proofs_route_missing");
  files.set(proofsRoute.file, renderRoute(proofsRoute));
  const { links, budget, assets } = measure();
  const late = [
    ...links.broken.map((link) => `link.broken:${link}`),
    ...budget.violations,
    ...assets.violations,
  ];
  if (late.length > 0) throw new Error(`site.gate_refused:${late.join(",")}`);

  return {
    files,
    report: {
      pages: routes.length,
      bricks: input.cards.length,
      inlineStyles: { examined: draft.length, violations: 0 },
      copy: { examined: copy.examined, violations: 0, forgeQuoted: forgePaths.size },
      claims: { examined: claims.examined, violations: 0 },
      links: { examined: links.examined, broken: 0 },
      budget: {
        examined: budget.examined,
        heaviest: budget.heaviest.page,
        gzipBytes: budget.heaviest.gzipBytes,
        violations: 0,
      },
      assets: { examined: assets.examined, violations: 0 },
      bytes: { script: size(script), stylesheet: size(stylesheet), sprite: size(sprite) },
    },
  };
}
