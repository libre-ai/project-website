/**
 * Data a V2 page needs beyond the cards, read and verified by the build entry point from pinned
 * copies. A page whose extra is absent states that no data was supplied, instead of inventing it.
 */
import type { DeployFacts } from "../deploy";
import type { LicenceRow } from "../licences";

export interface PageExtras {
  // One row per repository, and the pinned commit each row was read at.
  readonly licences?: {
    readonly rows: readonly LicenceRow[];
    readonly commits: ReadonlyMap<string, string>;
  };
  // The revisions the deploy document names, and the commit that document was read at.
  readonly deploy?: { readonly facts: DeployFacts; readonly commit: string };
}
