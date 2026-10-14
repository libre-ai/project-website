/**
 * Card fetch entry (G2): reads `project.v1.yaml` from each repository at the commit pinned in
 * src/data/card-sources.json, writes the versioned snapshot under src/data/cards, and records
 * the SHA-256 of each file next to its pin. Fails closed: every card is read before anything is
 * written, so a partial snapshot can never reach the build. Review the diff of both the snapshot
 * and card-sources.json before committing.
 *
 * Usage: bun src/fetch-cards-cli.ts [directory]   (default: src/data/cards)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sha256Hex } from "./cards-snapshot";
import { type CardSource, cardUrl, parseCardSources } from "./fetch-cards";

export async function fetchCardText(source: CardSource): Promise<string> {
  const proc = Bun.spawn(["gh", "api", cardUrl(source), "--jq", ".content"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (code !== 0) throw new Error(`card_fetch.unreadable:${source.repository}`);
  const text = Buffer.from(output.trim(), "base64").toString("utf8");
  if (text.trim() === "") throw new Error(`card_fetch.empty:${source.repository}`);
  return text;
}

export async function fetchCards(
  sources: readonly CardSource[],
  directory: string,
): Promise<readonly CardSource[]> {
  const texts = new Map<string, string>();
  for (const source of sources) texts.set(source.repository, await fetchCardText(source));
  await mkdir(directory, { recursive: true });
  const updated: CardSource[] = [];
  for (const source of sources) {
    const text = texts.get(source.repository) ?? "";
    await writeFile(join(directory, `${source.repository}.project.v1.yaml`), text, "utf8");
    updated.push({ ...source, sha256: sha256Hex(text) });
  }
  return updated;
}

if (import.meta.main) {
  const pinsPath = join(import.meta.dir, "data/card-sources.json");
  const sources = parseCardSources(await Bun.file(pinsPath).json());
  const directory = process.argv[2] ?? join(import.meta.dir, "data/cards");
  const updated = await fetchCards(sources, directory);
  const changed = updated.filter((entry, index) => entry.sha256 !== sources[index]?.sha256).length;
  await writeFile(pinsPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(
    `G2 fiches récupérées: ${updated.length} / ${sources.length} dépôts épinglés, empreintes modifiées: ${changed}`,
  );
}
