import { describe, expect, test } from "bun:test";

import { assertBrandPublishable, BRAND_CONTROLS, brandPublicationBlockers } from "./controls";

describe("brand publication controls (TRADEMARKS.md, Brand assets)", () => {
  test("today the licence text is accepted (2026-11-11) and the similarity review is pending", () => {
    expect(BRAND_CONTROLS).toEqual({ licenceTextAcceptedOn: "2026-11-11", similarityReview: null });
    expect(brandPublicationBlockers(BRAND_CONTROLS)).toEqual(["brand.similarity_review_missing"]);
    expect(() => assertBrandPublishable(BRAND_CONTROLS)).toThrow(
      "brand.publication_refused:brand.similarity_review_missing",
    );
  });

  test("publication fails closed while either control is pending", () => {
    expect(() =>
      assertBrandPublishable({ licenceTextAcceptedOn: null, similarityReview: null }),
    ).toThrow(
      "brand.publication_refused:brand.licence_text_not_accepted,brand.similarity_review_missing",
    );
    expect(() =>
      assertBrandPublishable({ licenceTextAcceptedOn: "2026-12-01", similarityReview: null }),
    ).toThrow("brand.similarity_review_missing");
    expect(() =>
      assertBrandPublishable({
        licenceTextAcceptedOn: null,
        similarityReview: {
          reviewedOn: "2026-12-01",
          archive: "docs/brand/similarity-2026-12-01.md",
        },
      }),
    ).toThrow("brand.licence_text_not_accepted");
  });

  test("publication is allowed once both controls are recorded", () => {
    expect(() =>
      assertBrandPublishable({
        licenceTextAcceptedOn: "2026-12-01",
        similarityReview: {
          reviewedOn: "2026-12-02",
          archive: "docs/brand/similarity-2026-12-02.md",
        },
      }),
    ).not.toThrow();
  });

  test("a control recorded with a malformed date counts as pending", () => {
    expect(
      brandPublicationBlockers({
        licenceTextAcceptedOn: "1er décembre",
        similarityReview: { reviewedOn: "2026-12-02", archive: "" },
      }),
    ).toEqual(["brand.licence_text_not_accepted", "brand.similarity_review_missing"]);
  });
});
