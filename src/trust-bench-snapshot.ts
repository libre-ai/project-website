/**
 * Trust bench snapshot gate: reads the pin and the versioned copy of the measure from a data
 * directory, checks the copy against the SHA-256 recorded at fetch time (the cards' own gate), then
 * its shape. A copy that is missing, empty, edited by hand or of another shape refuses the build;
 * nothing here goes on the network. The counters say what was read, so a pass is never compatible
 * with having read nothing.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { verifyCardSnapshot } from "./cards-snapshot";
import { parsePinnedSources } from "./fetch-cards";
import {
  parseTrustBench,
  TRUST_BENCH_COPY,
  TRUST_BENCH_PINS,
  TRUST_BENCH_REPOSITORY,
  type TrustBench,
  type TrustBenchCounts,
  trustBenchCounts,
} from "./trust-bench";

export interface LoadedTrustBench {
  readonly bench: TrustBench;
  /** Commit of the authority the copy was read at. */
  readonly commit: string;
  readonly counts: TrustBenchCounts;
}

async function readCopy(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    // Only an absent file is "missing"; any other failure to read keeps its own error.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function loadTrustBench(dataDirectory: string): Promise<LoadedTrustBench> {
  const pins = parsePinnedSources(await Bun.file(join(dataDirectory, TRUST_BENCH_PINS)).json());
  const [pin] = pins;
  if (pin === undefined || pins.length !== 1 || pin.repository !== TRUST_BENCH_REPOSITORY) {
    throw new Error("site.trust_bench_refused:pin_invalid");
  }
  const text = await readCopy(join(dataDirectory, TRUST_BENCH_COPY));
  const snapshot = verifyCardSnapshot(
    pins,
    text === null ? [] : [{ repository: pin.repository, text }],
  );
  if (snapshot.violations.length > 0) {
    throw new Error(`site.trust_bench_refused:${snapshot.violations.join(",")}`);
  }
  const bench = parseTrustBench(text ?? "");
  return { bench, commit: pin.sha, counts: trustBenchCounts(bench) };
}
