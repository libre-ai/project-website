/**
 * Licence fetch entry (S3.2): reads `REUSE.toml` from each repository at the commit pinned in
 * src/data/licence-sources.json, writes the versioned copy under src/data/licences, and records
 * the SHA-256 of each file next to its pin. Fails closed: every file is read before anything is
 * written. Review the diff of the copies and of the pins before committing.
 *
 * Usage: bun src/fetch-licences-cli.ts [directory]   (default: src/data/licences)
 */
import { join } from "node:path";

import { refreshPins } from "./fetch-pinned-io";

if (import.meta.main) {
  const result = await refreshPins({
    pinsPath: join(import.meta.dir, "data/licence-sources.json"),
    directory: process.argv[2] ?? join(import.meta.dir, "data/licences"),
    path: "REUSE.toml",
    copyName: (repository) => `${repository}.REUSE.toml`,
    label: "licence_fetch",
  });
  console.log(
    `S3.2 licences récupérées: ${result.total} / ${result.total} dépôts épinglés, empreintes modifiées: ${result.changed}`,
  );
}
