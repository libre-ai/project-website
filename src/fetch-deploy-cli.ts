/**
 * Deploy document fetch entry (S3.3): reads LOCAL-COMPOSITION.md from the authority at the commit
 * pinned in src/data/deploy-source.json, writes the versioned copy under src/data/deploy and
 * records its SHA-256 next to the pin. Review the diff of both before committing.
 *
 * Usage: bun src/fetch-deploy-cli.ts [directory]   (default: src/data/deploy)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sha256Hex } from "./cards-snapshot";
import { DEPLOY_PATH } from "./deploy";
import { OWNER, parseCardSources } from "./fetch-cards";

if (import.meta.main) {
  const pinsPath = join(import.meta.dir, "data/deploy-source.json");
  const [source] = parseCardSources(await Bun.file(pinsPath).json());
  if (source === undefined) throw new Error("deploy_fetch.no_pin");
  const url = `repos/${OWNER}/${source.repository}/contents/${DEPLOY_PATH}?ref=${source.sha}`;
  const proc = Bun.spawn(["gh", "api", url, "--jq", ".content"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (code !== 0) throw new Error(`deploy_fetch.unreadable:${source.repository}`);
  const text = Buffer.from(output.trim(), "base64").toString("utf8");
  if (text.trim() === "") throw new Error(`deploy_fetch.empty:${source.repository}`);
  const directory = process.argv[2] ?? join(import.meta.dir, "data/deploy");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "LOCAL-COMPOSITION.md"), text, "utf8");
  const updated = [{ ...source, sha256: sha256Hex(text) }];
  await writeFile(pinsPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`S3.3 document de déploiement récupéré: ${source.repository}@${source.sha}`);
}
