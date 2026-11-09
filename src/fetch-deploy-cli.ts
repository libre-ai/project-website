/**
 * Deploy document fetch entry (S3.3): reads LOCAL-COMPOSITION.md from the authority at the commit
 * pinned in src/data/deploy-source.json, writes the versioned copy under src/data/deploy and
 * records its SHA-256 next to the pin. Review the diff of both before committing.
 *
 * Usage: bun src/fetch-deploy-cli.ts [directory]   (default: src/data/deploy)
 */
import { join } from "node:path";

import { DEPLOY_PATH } from "./deploy";
import { refreshPins } from "./fetch-pinned-io";

if (import.meta.main) {
  const result = await refreshPins({
    pinsPath: join(import.meta.dir, "data/deploy-source.json"),
    directory: process.argv[2] ?? join(import.meta.dir, "data/deploy"),
    path: DEPLOY_PATH,
    // One document: the copy keeps the name it has in its repository.
    copyName: () => "LOCAL-COMPOSITION.md",
    label: "deploy_fetch",
  });
  console.log(
    `S3.3 document de déploiement récupéré: ${result.total} épinglé, empreintes modifiées: ${result.changed}`,
  );
}
