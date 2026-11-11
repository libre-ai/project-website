/**
 * Refreshes the versioned deployment artifact `site/` from the Libre IA build. The site carries
 * the figurative brand (ADR 0004), so the sync fails closed until both controls of TRADEMARKS.md
 * are recorded in src/brand/controls.ts (licence text accepted, dated similarity review archived).
 * Until then `site/` keeps the previous artifact, which carries no figurative asset.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { assertBrandPublishable } from "../../src/brand/controls";
import { writeStaticSite } from "../../src/build";

assertBrandPublishable();

const root = process.cwd();
// The build writes dist/ after its own gates and determinism check; site/ is a copy of it.
const build = Bun.spawnSync([process.execPath, "run", "build"], {
  stdout: "inherit",
  stderr: "inherit",
});
if (build.exitCode !== 0) throw new Error("sync.build_failed");

const dist = join(root, "dist");
const files = new Map<string, Uint8Array>();
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const absolute = join(entry.parentPath, entry.name);
  files.set(relative(dist, absolute), new Uint8Array(await readFile(absolute)));
}
await writeStaticSite(join(root, "site"), files);
console.log(`Synchronized ${files.size} guarded deployment files.`);
