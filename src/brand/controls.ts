/**
 * The two independent controls that TRADEMARKS.md (project-governance, « Brand assets ») requires
 * before any figurative asset is published: the owner accepts the exact text of
 * LicenseRef-Libre-AI-Brand-1.0, and a dated visual similarity review (EUIPO, INPI, WIPO and the
 * named reference set) is archived. Until both are recorded here, the martinet, the birds and the
 * objects are an unpublished candidate: a local build and the review sheet are allowed, any
 * publication fails closed.
 */

export interface SimilarityReview {
  /** ISO 8601 day of the review. */
  readonly reviewedOn: string;
  /** Repository path of the archived review. */
  readonly archive: string;
}

export interface BrandControls {
  /** ISO 8601 day on which the owner accepted the exact licence text, or null while pending. */
  readonly licenceTextAcceptedOn: string | null;
  readonly similarityReview: SimilarityReview | null;
}

// The owner accepted the exact text of LICENSES/LicenseRef-Libre-AI-Brand-1.0.txt on 2026-11-11;
// the similarity review is still pending, so publication stays closed.
export const BRAND_CONTROLS: BrandControls = {
  licenceTextAcceptedOn: "2026-11-11",
  similarityReview: null,
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function brandPublicationBlockers(controls: BrandControls): readonly string[] {
  const blockers: string[] = [];
  const accepted = controls.licenceTextAcceptedOn;
  if (accepted === null || !ISO_DAY.test(accepted))
    blockers.push("brand.licence_text_not_accepted");
  const review = controls.similarityReview;
  if (review === null || !ISO_DAY.test(review.reviewedOn) || review.archive.trim() === "") {
    blockers.push("brand.similarity_review_missing");
  }
  return blockers;
}

export function assertBrandPublishable(controls: BrandControls = BRAND_CONTROLS): void {
  const blockers = brandPublicationBlockers(controls);
  if (blockers.length > 0) throw new Error(`brand.publication_refused:${blockers.join(",")}`);
}
