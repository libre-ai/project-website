/**
 * Command-line entry for the site build. Kept apart from src/site.ts so the
 * logic stays importable and tested without running a build.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { checkBudget, PAGE_BUDGET_BYTES } from "./budget";
import { writeStaticSite } from "./build";
import { verifyCardSnapshot } from "./cards-snapshot";
import { diffOutputs } from "./determinism";
import { parseBrandProjection } from "./domain";
import { parseCardSources } from "./fetch-cards";
import { FONT_FILE, FONT_LICENSE_FILE, renderFontFace } from "./font";
import { loadPresentations } from "./presentation";
import { buildSite, type SourceFile } from "./site";
import { renderSiteCss } from "./styles";
import { checkCardUniverse, type Exclusion } from "./universe";

const CARD_SUFFIX = ".project.v1.yaml";

// Owner decision of 2026-10-14 (option 3): the build reads the versioned snapshot by default, so
// it needs no network and no variable. The snapshot is checked against the digests recorded at
// fetch time before anything else runs. LIBRE_AI_CARDS_DIR overrides the directory for local work.
const snapshotDirectory = join(import.meta.dir, "data/cards");
const pins = parseCardSources(
  await Bun.file(join(import.meta.dir, "data/card-sources.json")).json(),
);
const snapshotNames = (await readdir(snapshotDirectory)).filter((name) =>
  name.endsWith(CARD_SUFFIX),
);
const snapshot = verifyCardSnapshot(
  pins,
  await Promise.all(
    snapshotNames.map(async (name) => ({
      repository: name.replace(CARD_SUFFIX, ""),
      text: await readFile(join(snapshotDirectory, name), "utf8"),
    })),
  ),
);
if (snapshot.violations.length > 0) {
  throw new Error(`site.snapshot_refused:${snapshot.violations.join(",")}`);
}

const cardsDirectory = process.env.LIBRE_AI_CARDS_DIR || snapshotDirectory;
const names = (await readdir(cardsDirectory)).filter((name) => name.endsWith(CARD_SUFFIX));
const sources: SourceFile[] = [];
for (const name of names.sort()) {
  sources.push({ name, text: await readFile(join(cardsDirectory, name), "utf8") });
}

// The UI package is the authority for tokens and base styles, read from the pinned install.
const uiRoot = join(process.cwd(), "node_modules/@libre-ai/ui/src");
const fontRoot = join(process.cwd(), "node_modules/@fontsource-variable/source-sans-3");
const assets = {
  tokens: await readFile(join(uiRoot, "tokens.css"), "utf8"),
  styles: `${renderFontFace()}\n${(await readFile(join(uiRoot, "styles.css"), "utf8")).trimEnd()}\n\n${renderSiteCss()}`,
};

// Presentations are editorial content of this repository (docs/, CC-BY-4.0), one file per product.
const presentations = await loadPresentations(join(process.cwd(), "docs/presentations"));
const snapshotProof = {
  gate: "G2 instantané des fiches vérifié contre les empreintes épinglées",
  examined: snapshot.examined,
  violations: snapshot.violations.length,
  command: "bun run build",
};
// The brand copy of the home page comes from the governance projection, validated by the same
// parser as the legacy generator: a malformed or missing projection refuses the build.
const brandProjection = parseBrandProjection(
  await Bun.file(
    join(process.cwd(), "node_modules/@libre-ai/governance/brand/projections/public-brand.v1.json"),
  ).json(),
);
const result = buildSite(sources, assets, presentations, [snapshotProof], brandProjection.copy.fr);

// The portfolio is the authority for which repositories are products; the exclusions are data.
const portfolio = (await Bun.file(
  join(process.cwd(), "node_modules/@libre-ai/governance/ecosystem/portfolio.v1.json"),
).json()) as { items: { repository: string }[] };
const exclusions = (await Bun.file(
  join(import.meta.dir, "data/card-exclusions.json"),
).json()) as Exclusion[];
const universe = checkCardUniverse({
  repositories: portfolio.items.map((item) => item.repository),
  cards: result.projects,
  exclusions,
});
if (universe.violations.length > 0) {
  throw new Error(`site.universe_refused:${universe.violations.join(",")}`);
}

// Binary assets are copied byte for byte; the licence ships with the font it covers.
const binaries = new Map<string, Uint8Array>([
  [
    `assets/fonts/${FONT_FILE}`,
    new Uint8Array(await Bun.file(join(fontRoot, "files", FONT_FILE)).arrayBuffer()),
  ],
  [FONT_LICENSE_FILE, new Uint8Array(await Bun.file(join(fontRoot, "LICENSE")).arrayBuffer())],
]);
const output = new Map<string, string | Uint8Array>([...result.files, ...binaries]);

// S6.4: a second assembly of the same input must write the same bytes; a difference refuses the build.
const second = buildSite(sources, assets, presentations, [snapshotProof], brandProjection.copy.fr);
const differing = diffOutputs(result.files, second.files);
if (differing.length > 0) throw new Error(`site.nondeterministic:${differing.join(",")}`);

// S6.5: what a visitor downloads for one page stays under the budget, measured on the output.
const budget = checkBudget(output);
if (budget.violations.length > 0)
  throw new Error(`site.budget_refused:${budget.violations.join(",")}`);

await writeStaticSite(join(process.cwd(), "dist"), output);
console.log(
  `G2 instantané: ${snapshot.examined} fiches vérifiées contre leurs empreintes (source: ${cardsDirectory === snapshotDirectory ? "instantané versionné" : cardsDirectory})`,
);
console.log(`G2 univers: ${universe.universe}, fiches couvrant l'univers: ${universe.covered}`);
console.log(
  `G2 fiches lues: ${result.report.cardsRead}, pages produit: ${result.report.productPages}`,
);
console.log(`G1 pages fixes: ${result.report.fixedPages}, fichiers écrits: ${result.files.size}`);
console.log(`O2 champs de marque rendus: ${result.report.brandFieldsRendered}`);
console.log(`NFR déterminisme: deux assemblages, ${result.files.size} fichiers, 0 différence`);
console.log(
  `NFR poids: ${budget.examined} pages, la plus lourde ${budget.heaviest.page} (${budget.heaviest.bytes} octets sur ${PAGE_BUDGET_BYTES})`,
);
console.log(`G3 ressources examinées: ${result.report.resourcesExamined}`);
console.log(
  `ADR 0003 présentations: ${result.report.presentationsDrafted} rédigées, ${result.report.presentationsReviewed} relues et publiées`,
);
console.log(
  `G9 textes examinés: ${result.report.textsExamined}, violations: ${result.report.claimViolations}`,
);
