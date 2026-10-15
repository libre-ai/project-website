/**
 * Card fetch entry (G2): reads `project.v1.yaml` from each repository at the commit pinned in
 * src/data/card-sources.json, writes the versioned snapshot under src/data/cards, and records
 * the SHA-256 of each file next to its pin. Fails closed: every card is read before anything is
 * written, so a partial snapshot can never reach the build. Review the diff of both the snapshot
 * and card-sources.json before committing.
 *
 * Usage: bun src/fetch-cards-cli.ts [directory]   (default: src/data/cards)
 */
import { join } from "node:path";

import { CARD_PATH } from "./fetch-cards";
import { refreshPins } from "./fetch-pinned-io";

if (import.meta.main) {
  const result = await refreshPins({
    pinsPath: join(import.meta.dir, "data/card-sources.json"),
    directory: process.argv[2] ?? join(import.meta.dir, "data/cards"),
    path: CARD_PATH,
    copyName: (repository) => `${repository}.project.v1.yaml`,
    label: "card_fetch",
  });
  console.log(
    `G2 fiches récupérées: ${result.total} / ${result.total} dépôts épinglés, empreintes modifiées: ${result.changed}`,
  );
}
