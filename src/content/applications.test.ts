import { describe, expect, test } from "bun:test";

import { checkCopy } from "../web/gates";
import { APPLICATIONS, applicationOf, slugify } from "./applications";
import { universeOf } from "./universes";

describe("applications (ADR 0007 §5)", () => {
  test("40 applications, P01 to P40 exactly once, in reference order", () => {
    expect(APPLICATIONS.map((application) => application.ref)).toEqual(
      Array.from({ length: 40 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`),
    );
  });

  test("the six names arbitrated on 2026-11-09 are tranché, every other one provisoire", () => {
    const decided = APPLICATIONS.filter((application) => application.nameStatus === "tranché");
    expect(decided.map((application) => `${application.ref} ${application.name}`)).toEqual([
      "P01 Sources",
      "P03 Corpus",
      "P14 Canevas",
      "P28 Tempo",
      "P29 Antenne",
      "P39 Cours",
    ]);
    expect(
      APPLICATIONS.filter((application) => application.nameStatus === "provisoire"),
    ).toHaveLength(34);
  });

  test("each application takes its universe from the owner's distribution", () => {
    for (const application of APPLICATIONS)
      expect(application.universe).toBe(universeOf(application.ref));
  });

  test("slugs derive from names, are unique and url-safe", () => {
    const slugs = APPLICATIONS.map((application) => application.slug);
    expect(new Set(slugs).size).toBe(40);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(applicationOf("P07").slug).toBe(slugify(applicationOf("P07").name));
  });

  test("slugify folds accents, case and punctuation", () => {
    expect(slugify("Médiathèque")).toBe("mediatheque");
    expect(slugify("JdR")).toBe("jdr");
    expect(slugify("Tâches à faire")).toBe("taches-a-faire");
  });

  test("every application has a promise, and none passes the forbidden wording of the pages", () => {
    for (const application of APPLICATIONS) expect(application.promise.length).toBeGreaterThan(10);
    const report = checkCopy(
      APPLICATIONS.map((application) => ({ page: application.ref, html: application.promise })),
    );
    expect(report.examined).toBe(40);
    expect(report.violations).toEqual([]);
  });

  test("an unknown reference is refused", () => {
    expect(() => applicationOf("P41")).toThrow("content.application_unknown");
  });
});
