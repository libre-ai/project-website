/**
 * Command-line entry for the Libre IA site build (plan, Task 9). It reads and verifies the
 * pinned inputs (card snapshot, licences, deploy document, portfolio universe), reads the fonts
 * from their pinned packages, assembles the site twice and refuses any difference, writes dist/
 * and prints the counters of every gate. Kept apart from src/web/site.ts so the assembly stays
 * importable and tested without running a build.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { PAGE_BUDGET_BYTES } from "./budget";
import { verifyCardSnapshot } from "./cards-snapshot";
import { DEPLOY_REPOSITORY, parseDeployFacts } from "./deploy";
import { diffOutputs } from "./determinism";
import { parsePinnedSources } from "./fetch-cards";
import { FONTS } from "./font";
import { parseLicences } from "./licences";
import type { PageExtras } from "./pages/extras";
import type { Proof } from "./pages/proofs";
import { parsePortfolio } from "./portfolio";
import { loadPresentations } from "./presentation";
import { parseProjectCard } from "./project-card";
import { checkCardUniverse, type Exclusion } from "./universe";
import { buildLibreSite, type LibreSiteInput } from "./web/site";
import { writeStaticSite } from "./write-site";

const CARD_SUFFIX = ".project.v1.yaml";
const LICENCE_SUFFIX = ".REUSE.toml";
const COMMAND = "bun run build";

// Owner decision of 2026-10-14 (option 3): the build reads the versioned snapshot by default, so
// it needs no network and no variable. The snapshot is checked against the digests recorded at
// fetch time before anything else runs. LIBRE_AI_CARDS_DIR overrides the directory for local work.
const snapshotDirectory = join(import.meta.dir, "data/cards");
const pins = parsePinnedSources(
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

// S3.2: licences, versioned REUSE.toml copies verified against their pinned digests.
const licenceDirectory = join(import.meta.dir, "data/licences");
const licencePins = parsePinnedSources(
  await Bun.file(join(import.meta.dir, "data/licence-sources.json")).json(),
);
const licenceFiles = await Promise.all(
  (await readdir(licenceDirectory))
    .filter((name) => name.endsWith(LICENCE_SUFFIX))
    .sort()
    .map(async (name) => ({
      repository: name.replace(LICENCE_SUFFIX, ""),
      text: await readFile(join(licenceDirectory, name), "utf8"),
    })),
);
const licenceSnapshot = verifyCardSnapshot(licencePins, licenceFiles);
if (licenceSnapshot.violations.length > 0) {
  throw new Error(`site.licences_refused:${licenceSnapshot.violations.join(",")}`);
}

// S3.3: the deploy document, verified like the cards; a missing or non-commit revision refuses.
const deployPins = parsePinnedSources(
  await Bun.file(join(import.meta.dir, "data/deploy-source.json")).json(),
);
const deployFile = {
  repository: DEPLOY_REPOSITORY,
  text: await readFile(join(import.meta.dir, "data/deploy/LOCAL-COMPOSITION.md"), "utf8"),
};
const deploySnapshot = verifyCardSnapshot(deployPins, [deployFile]);
if (deploySnapshot.violations.length > 0) {
  throw new Error(`site.deploy_refused:${deploySnapshot.violations.join(",")}`);
}
const deployPin = deployPins[0];
if (deployPin === undefined) throw new Error("site.deploy_refused:pin_missing");

const extras: PageExtras = {
  licences: {
    rows: licenceFiles.map((file) => parseLicences(file.repository, file.text)),
    commits: new Map(licencePins.map((pin) => [pin.repository, pin.sha])),
  },
  deploy: { facts: parseDeployFacts(deployFile.text), commit: deployPin.sha },
};

const cardsDirectory = process.env.LIBRE_AI_CARDS_DIR || snapshotDirectory;
const cardNames = (await readdir(cardsDirectory))
  .filter((name) => name.endsWith(CARD_SUFFIX))
  .sort();
const cards = await Promise.all(
  cardNames.map(async (name) =>
    parseProjectCard(Bun.YAML.parse(await readFile(join(cardsDirectory, name), "utf8"))),
  ),
);

// The portfolio is the authority for which repositories are products, validated at its fixed
// count before use (AGENTS.md, Boundaries); the exclusions are data.
const portfolio = parsePortfolio(
  await Bun.file(
    join(process.cwd(), "node_modules/@libre-ai/governance/ecosystem/portfolio.v1.json"),
  ).json(),
);
const exclusions = (await Bun.file(
  join(import.meta.dir, "data/card-exclusions.json"),
).json()) as Exclusion[];
const universe = checkCardUniverse({
  repositories: portfolio.items.map((item) => item.repository),
  cards: cards.map((card) => card.project),
  exclusions,
});
if (universe.violations.length > 0) {
  throw new Error(`site.universe_refused:${universe.violations.join(",")}`);
}

// Fonts and their licences, byte for byte from the pinned packages (ADR 0004 §4).
const fonts = new Map<string, Uint8Array>();
for (const font of FONTS) {
  const packageRoot = join(process.cwd(), "node_modules", font.packageDir);
  fonts.set(
    `assets/fonts/${font.file}`,
    new Uint8Array(await Bun.file(join(packageRoot, "files", font.file)).arrayBuffer()),
  );
  fonts.set(
    font.licenseFile,
    new Uint8Array(await Bun.file(join(packageRoot, "LICENSE")).arrayBuffer()),
  );
}

const priorProofs: Proof[] = [
  {
    gate: "G2 instantané des fiches vérifié contre les empreintes épinglées",
    examined: snapshot.examined,
    violations: 0,
    command: COMMAND,
  },
  {
    gate: "S3.2 licences vérifiées contre les empreintes épinglées",
    examined: licenceSnapshot.examined,
    violations: 0,
    command: COMMAND,
  },
  {
    gate: "S3.3 document de déploiement vérifié",
    examined: deploySnapshot.examined,
    violations: 0,
    command: COMMAND,
  },
  {
    gate: "G2 univers du portefeuille couvert",
    examined: universe.universe,
    violations: 0,
    command: COMMAND,
  },
];

const input: LibreSiteInput = {
  cards,
  presentations: await loadPresentations(join(process.cwd(), "docs/presentations")),
  extras,
  priorProofs,
  fonts,
};
const { files, report } = await buildLibreSite(input);

// S6.4: a second assembly of the same input must write the same bytes.
const second = await buildLibreSite(input);
const differing = diffOutputs(files, second.files);
if (differing.length > 0) throw new Error(`site.nondeterministic:${differing.join(",")}`);

await writeStaticSite(join(process.cwd(), "dist"), files);

console.log(`G2 instantané: ${snapshot.examined} fiches vérifiées contre leurs empreintes`);
console.log(`G2 univers: ${universe.universe}, fiches couvrant l'univers: ${universe.covered}`);
console.log(`S3.2 licences: ${licenceSnapshot.examined} fichiers vérifiés`);
console.log(`S3.3 déployer: document vérifié (${deploySnapshot.examined})`);
console.log(
  `Pages: ${report.pages}, dont briques de la forge: ${report.bricks}, fichiers écrits: ${files.size}`,
);
console.log(
  `ADR 0005 styles en ligne: ${report.inlineStyles.examined} pages examinées, violations: 0`,
);
console.log(
  `ADR 0007 copie: ${report.copy.examined} pages examinées, violations: 0 (pages de forge citées telles quelles: ${report.copy.forgeQuoted})`,
);
console.log(`G9 textes examinés: ${report.claims.examined}, violations: 0`);
console.log(`Liens internes: ${report.links.examined} examinés, 0 cassé`);
console.log(
  `NFR poids: ${report.budget.examined} pages, la plus lourde ${report.budget.heaviest} (${report.budget.gzipBytes} octets transférés en gzip sur ${PAGE_BUDGET_BYTES})`,
);
console.log(
  `NFR fichiers partagés: script ${report.bytes.script} octets sur 16384, feuille ${report.bytes.stylesheet} sur 49152, sprite ${report.bytes.sprite} sur 81920`,
);
console.log(`NFR déterminisme: deux assemblages, ${files.size} fichiers, 0 différence`);
