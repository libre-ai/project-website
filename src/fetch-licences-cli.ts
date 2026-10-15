/**
 * Licence fetch entry (S3.2): reads `REUSE.toml` from each repository at the commit pinned in
 * src/data/licence-sources.json, writes the versioned copy under src/data/licences, and records
 * the SHA-256 of each file next to its pin. Fails closed: every file is read before anything is
 * written. Review the diff of the copies and of the pins before committing.
 *
 * Usage: bun src/fetch-licences-cli.ts [directory]   (default: src/data/licences)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sha256Hex } from "./cards-snapshot";
import { type CardSource, OWNER, parseCardSources } from "./fetch-cards";

export const LICENCE_PATH = "REUSE.toml";

export function licenceUrl(source: CardSource): string {
  return `repos/${OWNER}/${source.repository}/contents/${LICENCE_PATH}?ref=${source.sha}`;
}

async function fetchLicenceText(source: CardSource): Promise<string> {
  const proc = Bun.spawn(["gh", "api", licenceUrl(source), "--jq", ".content"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (code !== 0) throw new Error(`licence_fetch.unreadable:${source.repository}`);
  const text = Buffer.from(output.trim(), "base64").toString("utf8");
  if (text.trim() === "") throw new Error(`licence_fetch.empty:${source.repository}`);
  return text;
}

if (import.meta.main) {
  const pinsPath = join(import.meta.dir, "data/licence-sources.json");
  const sources = parseCardSources(await Bun.file(pinsPath).json());
  const directory = process.argv[2] ?? join(import.meta.dir, "data/licences");
  const texts = new Map<string, string>();
  for (const source of sources) texts.set(source.repository, await fetchLicenceText(source));
  await mkdir(directory, { recursive: true });
  const updated: CardSource[] = [];
  for (const source of sources) {
    const text = texts.get(source.repository) ?? "";
    await writeFile(join(directory, `${source.repository}.REUSE.toml`), text, "utf8");
    updated.push({ ...source, sha256: sha256Hex(text) });
  }
  const changed = updated.filter((entry, index) => entry.sha256 !== sources[index]?.sha256).length;
  await writeFile(pinsPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(
    `S3.2 licences récupérées: ${updated.length} / ${sources.length} dépôts épinglés, empreintes modifiées: ${changed}`,
  );
}
