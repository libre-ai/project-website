import { describe, expect, test } from "bun:test";

import { checkCopy } from "../web/gates";
import { APPLICATIONS, applicationOf, slugify } from "./applications";
import { universeOf } from "./universes";

describe("applications (ADR 0007 §5, amended by ADR 0010 §7)", () => {
  test("41 applications, P01 to P41 exactly once, in reference order", () => {
    expect(APPLICATIONS.map((application) => application.ref)).toEqual(
      Array.from({ length: 41 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`),
    );
  });

  test("the six arbitrated names are tranché, every other one provisoire", () => {
    const decided = APPLICATIONS.filter((application) => application.nameStatus === "tranché");
    expect(decided.map((application) => `${application.ref} ${application.name}`)).toEqual([
      "P01 Sources",
      "P03 Biblio",
      "P14 Canevas",
      "P28 Tempo",
      "P29 Antenne",
      "P39 Cours",
    ]);
    expect(
      APPLICATIONS.filter((application) => application.nameStatus === "provisoire"),
    ).toHaveLength(35);
  });

  test("P15 is Remontées and P41 Tickets, both provisoire (ADR 0010 §7)", () => {
    expect(applicationOf("P15")).toMatchObject({ name: "Remontées", nameStatus: "provisoire" });
    expect(applicationOf("P41")).toMatchObject({ name: "Tickets", nameStatus: "provisoire" });
  });

  test("each application takes its universe from the owner's distribution", () => {
    for (const application of APPLICATIONS)
      expect(application.universe).toBe(universeOf(application.ref));
  });

  test("slugs derive from names, are unique and url-safe", () => {
    const slugs = APPLICATIONS.map((application) => application.slug);
    expect(new Set(slugs).size).toBe(41);
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
    expect(report.examined).toBe(41);
    expect(report.violations).toEqual([]);
  });

  test("an unknown reference is refused", () => {
    expect(() => applicationOf("P42")).toThrow("content.application_unknown");
  });
});
