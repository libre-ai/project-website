/**
 * Rebuilds the Caveat subset of the handwritten notes (ADR 0010 §2) and its manifest.
 *
 * The full latin face weighs 51,220 bytes and every page counts every face its stylesheet declares
 * (src/budget.ts); the notes use a few dozen characters. The subset keeps exactly the characters of
 * HAND_NOTES (src/content/home.ts), cut from the face of the pinned @fontsource package, so the
 * served file stays tied to its source: src/font.test.ts fails when a note uses a character the
 * subset lacks, when the committed file differs from the manifest, or when the pinned source moves.
 *
 * Usage, from the repository root, after `bun install`: `bun tools/fonts/subset-caveat.ts`.
 * Needs `uvx` (uv) on the PATH; fonttools is pinned below and fetched by uv.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { handCharacters } from "../../src/content/home";
import { CAVEAT_SUBSET, type SubsetManifest } from "../../src/font";

const FONTTOOLS = "fonttools[woff]==4.60.1";

const root = join(import.meta.dir, "..", "..");
const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const packageDir = join(root, "node_modules", CAVEAT_SUBSET.source.package);
const version = (
  JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
    version: string;
  }
).version;
const source = join(packageDir, CAVEAT_SUBSET.source.file);
const output = join(root, CAVEAT_SUBSET.output);
const characters = handCharacters();

const run = Bun.spawnSync(
  [
    "uvx",
    "-q",
    "--from",
    FONTTOOLS,
    "pyftsubset",
    source,
    `--text=${characters}`,
    "--flavor=woff2",
    `--output-file=${output}`,
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (run.exitCode !== 0) throw new Error(`pyftsubset failed with exit code ${run.exitCode}`);

const manifest: SubsetManifest = {
  source: {
    package: CAVEAT_SUBSET.source.package,
    version,
    file: CAVEAT_SUBSET.source.file,
    sha256: sha256(source),
  },
  tool: FONTTOOLS,
  characters,
  output: {
    file: CAVEAT_SUBSET.output,
    sha256: sha256(output),
    bytes: readFileSync(output).length,
  },
};
writeFileSync(join(root, CAVEAT_SUBSET.manifest), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`subset: ${manifest.output.bytes} bytes, ${[...characters].length} characters`);
