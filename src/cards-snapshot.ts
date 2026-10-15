/**
 * Card snapshot gate (G2, owner decision of 2026-10-14, option 3): the cards the build reads
 * are a versioned copy under src/data/cards, taken from each repository at the commit pinned in
 * src/data/card-sources.json. The fetch records the SHA-256 of each file it wrote; this gate
 * recomputes it on the copy, so a copy edited by hand, missing, or left over fails the build
 * without any network access. The authority stays the repository; the copy is a controlled one.
 */
import type { PinnedSource } from "./fetch-cards";

export interface SnapshotFile {
  readonly repository: string;
  readonly text: string;
}

export interface SnapshotReport {
  readonly examined: number;
  readonly violations: readonly string[];
}

export function sha256Hex(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

export function verifyCardSnapshot(
  sources: readonly PinnedSource[],
  files: readonly SnapshotFile[],
): SnapshotReport {
  const violations: string[] = [];
  const byRepository = new Map(files.map((file) => [file.repository, file]));
  for (const source of sources) {
    const file = byRepository.get(source.repository);
    if (file === undefined) {
      violations.push(`snapshot.missing:${source.repository}`);
      continue;
    }
    if (sha256Hex(file.text) !== source.sha256) {
      violations.push(`snapshot.digest_mismatch:${source.repository}`);
    }
  }
  const pinned = new Set(sources.map((source) => source.repository));
  for (const file of files) {
    if (!pinned.has(file.repository)) violations.push(`snapshot.unpinned:${file.repository}`);
  }
  return { examined: sources.length, violations };
}
