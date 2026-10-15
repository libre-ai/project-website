/**
 * Data a page needs beyond the cards, read and verified by the build entry point from pinned
 * copies. A page whose data is absent states that none was supplied, instead of inventing it.
 */
import type { DeployFacts } from "../deploy";
import type { PublicBrandCopy, PublicProof } from "../domain";
import type { LicenceRow } from "../licences";
import type { Presentation } from "../presentation";
import type { Proof } from "./proofs";

export interface PageExtras {
  // One row per repository, and the pinned commit each row was read at.
  readonly licences?: {
    readonly rows: readonly LicenceRow[];
    readonly commits: ReadonlyMap<string, string>;
  };
  // The revisions the deploy document names, and the commit that document was read at.
  readonly deploy?: { readonly facts: DeployFacts; readonly commit: string };
}

// Everything optional a page render takes, named instead of positional.
export interface PageOptions {
  // Gate results shown on the proofs page.
  readonly proofs?: readonly Proof[];
  readonly presentations?: ReadonlyMap<string, Presentation>;
  // The home page's brand copy and the method page's affirmations, from the governance projection.
  readonly brand?: PublicBrandCopy;
  readonly brandProofs?: readonly PublicProof[];
  readonly extras?: PageExtras;
}
