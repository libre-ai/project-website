/**
 * Card fetch entry (G2): reads `project.v1.yaml` from each repository at the commit pinned in
 * src/data/card-sources.json, and writes `<repository>.project.v1.yaml` into the target
 * directory. Fails closed: every card is read before anything is written, so a partial
 * directory can never reach the build.
 *
 * Usage: bun src/fetch-cards-cli.ts <directory>
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
): Promise<number> {
  const texts = new Map<string, string>();
  for (const source of sources) texts.set(source.repository, await fetchCardText(source));
  await mkdir(directory, { recursive: true });
  for (const [repository, text] of texts) {
    await writeFile(join(directory, `${repository}.project.v1.yaml`), text, "utf8");
  }
  return texts.size;
}

if (import.meta.main) {
  const sources = parseCardSources(
    await Bun.file(join(import.meta.dir, "data/card-sources.json")).json(),
  );
  const directory = process.argv[2];
  if (directory === undefined || directory === "") throw new Error("card_fetch.directory_not_set");
  const count = await fetchCards(sources, directory);
  console.log(`G2 fiches récupérées: ${count} / ${sources.length} dépôts épinglés`);
}
