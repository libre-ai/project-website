/**
 * Command-line entry for the site build. Kept apart from src/site.ts so the
 * logic stays importable and tested without running a build.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { writeStaticSite } from "./build";
import { buildSite, type SourceFile } from "./site";
import { renderSiteCss } from "./styles";

const CARD_SUFFIX = ".project.v1.yaml";

// The card directory is named explicitly, never guessed.
const cardsDirectory = process.env.LIBRE_AI_CARDS_DIR;
if (cardsDirectory === undefined || cardsDirectory === "") {
  throw new Error("cards.directory_not_set");
}

const names = (await readdir(cardsDirectory)).filter((name) => name.endsWith(CARD_SUFFIX));
const sources: SourceFile[] = [];
for (const name of names.sort()) {
  sources.push({ name, text: await readFile(join(cardsDirectory, name), "utf8") });
}

// The UI package is the authority for tokens and base styles, read from the pinned install.
const uiRoot = join(process.cwd(), "node_modules/@libre-ai/ui/src");
const assets = {
  tokens: await readFile(join(uiRoot, "tokens.css"), "utf8"),
  styles: `${(await readFile(join(uiRoot, "styles.css"), "utf8")).trimEnd()}\n\n${renderSiteCss()}`,
};

const result = buildSite(sources, assets);
await writeStaticSite(join(process.cwd(), "dist"), result.files);
console.log(
  `G2 fiches lues: ${result.report.cardsRead}, pages produit: ${result.report.productPages}`,
);
console.log(`G1 pages fixes: ${result.report.fixedPages}, fichiers écrits: ${result.files.size}`);
console.log(`G3 ressources examinées: ${result.report.resourcesExamined}`);
console.log(
  `G9 textes examinés: ${result.report.textsExamined}, violations: ${result.report.claimViolations}`,
);
