/**
 * Trust bench fetch entry: reads `distribution/index/trust-bench.v1.json` from the authority at the
 * commit pinned in src/data/trust-bench-source.json, writes the versioned copy under
 * src/data/trust-bench and records its SHA-256 next to the pin. The copy is then loaded as the
 * build loads it, so a file of another shape is caught here. Review the diff of both before
 * committing.
 *
 * Usage: bun src/fetch-trust-bench-cli.ts
 */
import { dirname, join } from "node:path";

import { refreshPins } from "./fetch-pinned-io";
import { TRUST_BENCH_COPY, TRUST_BENCH_PATH, TRUST_BENCH_PINS } from "./trust-bench";
import { loadTrustBench } from "./trust-bench-snapshot";

if (import.meta.main) {
  const data = join(import.meta.dir, "data");
  const copy = join(data, TRUST_BENCH_COPY);
  const result = await refreshPins({
    pinsPath: join(data, TRUST_BENCH_PINS),
    directory: dirname(copy),
    path: TRUST_BENCH_PATH,
    // One document: the copy keeps the name it has in its repository.
    copyName: () => "trust-bench.v1.json",
    label: "trust_bench_fetch",
  });
  const { counts } = await loadTrustBench(data);
  console.log(
    `Banc de confiance récupéré: ${result.total} épinglé, empreintes modifiées: ${result.changed} ; mesures: ${counts.measures}, couches: ${counts.layers}, défauts semés: ${counts.defects}, cas sains: ${counts.healthy}, modèles: ${counts.models}, bascules du second passage: ${counts.flips}`,
  );
}
