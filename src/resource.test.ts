import { describe, expect, test } from "bun:test";

import { checkResourceGates, parseResource } from "./resource";

const guide = {
  title: "Comprendre une fiche produit",
  author: "Auteur de test",
  ai_assistance: "Rédaction assistée par un modèle de langage, relue par l'auteur.",
  nature: "guide",
  review_date: "2026-10-14",
};

describe("parseResource (FR-04 : une ressource sans les quatre champs ne se construit pas)", () => {
  test("builds a resource carrying author, AI assistance, nature and review date", () => {
    const resource = parseResource(guide);
    expect(resource.author).toBe("Auteur de test");
    expect(resource.aiAssistance).toContain("modèle de langage");
    expect(resource.nature).toBe("guide");
    expect(resource.reviewDate).toBe("2026-10-14");
  });

  test.each([
    "author",
    "ai_assistance",
    "nature",
    "review_date",
  ])("rejects a resource without %s", (field) => {
    const { [field]: _omitted, ...rest } = guide;
    expect(() => parseResource(rest)).toThrow(`resource.${field}_invalid:Comprendre`);
  });

  test("rejects a blank author", () => {
    expect(() => parseResource({ ...guide, author: "   " })).toThrow(
      "resource.author_invalid:Comprendre",
    );
  });

  test("rejects a nature outside fait, analyse, opinion, guide (§9)", () => {
    expect(() => parseResource({ ...guide, nature: "publicité" })).toThrow(
      "resource.nature_invalid:Comprendre",
    );
  });

  test("rejects a review date that is not a real ISO 8601 day", () => {
    expect(() => parseResource({ ...guide, review_date: "2026-02-30" })).toThrow(
      "resource.review_date_invalid:Comprendre",
    );
  });
});

describe("checkResourceGates", () => {
  test("counts every resource examined", () => {
    const report = checkResourceGates([
      parseResource(guide),
      parseResource({ ...guide, nature: "fait" }),
    ]);
    expect(report).toEqual({ examined: 2, violations: [] });
  });

  test("reports zero examined for an empty corpus instead of passing silently", () => {
    expect(checkResourceGates([])).toEqual({ examined: 0, violations: [] });
  });
});
