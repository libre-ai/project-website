/**
 * Pinned fetch, input and output (G2, S3.2, S3.3): the one way the repository reads a file of
 * another repository. Every versioned copy (cards, licences, the deploy document) is read at a
 * commit pinned in a data file, written next to the others, and its SHA-256 recorded back in that
 * pin. Network and disk only; the rules are in fetch-pinned.ts and fetch-cards.ts.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sha256Hex } from "./cards-snapshot";
import { type PinnedSource, parsePinnedSources } from "./fetch-cards";
import { pinnedUrl } from "./fetch-pinned";

async function fetchPinnedText(source: PinnedSource, path: string, label: string): Promise<string> {
  const proc = Bun.spawn(["gh", "api", pinnedUrl(source, path), "--jq", ".content"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  if (code !== 0) throw new Error(`${label}.unreadable:${source.repository}`);
  const text = Buffer.from(output.trim(), "base64").toString("utf8");
  if (text.trim() === "") throw new Error(`${label}.empty:${source.repository}`);
  return text;
}

export interface RefreshSpec {
  // Pin file (data) and the directory that holds the versioned copies.
  readonly pinsPath: string;
  readonly directory: string;
  // File read in each pinned repository, and the name its copy is written under.
  readonly path: string;
  readonly copyName: (repository: string) => string;
  // Error prefix: `${label}.unreadable:<repository>`.
  readonly label: string;
}

// Reads every file before writing anything, so a partial snapshot can never be left behind,
// then records the new digests next to the pins. Returns how many digests changed.
export async function refreshPins(
  spec: RefreshSpec,
): Promise<{ readonly total: number; readonly changed: number }> {
  const sources = parsePinnedSources(await Bun.file(spec.pinsPath).json());
  const texts = new Map<string, string>();
  for (const source of sources) {
    texts.set(source.repository, await fetchPinnedText(source, spec.path, spec.label));
  }
  await mkdir(spec.directory, { recursive: true });
  const updated: PinnedSource[] = [];
  for (const source of sources) {
    const text = texts.get(source.repository) ?? "";
    await writeFile(join(spec.directory, spec.copyName(source.repository)), text, "utf8");
    updated.push({ ...source, sha256: sha256Hex(text) });
  }
  await writeFile(spec.pinsPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  const changed = updated.filter((entry, index) => entry.sha256 !== sources[index]?.sha256).length;
  return { total: updated.length, changed };
}
