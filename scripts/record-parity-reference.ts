/**
 * Records the digests of the Bun reference files (server/parity/reference.ts). Run it only after
 * reviewing what changed in the reference: the parity test then holds the port to the new one.
 */
import { join } from "node:path";

import { FINGERPRINT_PATH, fingerprint, ROOT, renderFingerprint } from "../server/parity/reference";

await Bun.write(join(ROOT, FINGERPRINT_PATH), renderFingerprint(await fingerprint()));
console.log(`Recorded ${FINGERPRINT_PATH}.`);
