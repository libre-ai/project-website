import { describe, expect, test } from "bun:test";

import { checkProjectCardGates, parseProjectCard } from "./project-card";

const usable = {
  project: "notebook",
  repository: "libre-ai/notebook",
  maturity: "usable",
  exposure: "usable-verifiable",
  summary: "Espace de connaissances local.",
  current_situation: "Parcours local vérifié sur la branche servie.",
  non_goals: ["Pas de synchronisation cloud."],
  application_url: "https://notebook.example.test/",
  freshness: { last_verified_on: "2026-10-08" },
};

const idea = {
  project: "sketch",
  repository: "libre-ai/sketch",
  maturity: "idea",
  exposure: "idea",
  summary: "Idée non spécifiée.",
  current_situation: "Aucun code n'existe encore à ce stade.",
  non_goals: ["Pas d'engagement de date."],
  freshness: { last_verified_on: "2026-10-08" },
};

describe("parseProjectCard (FR-12 : date de vérification lue)", () => {
  test("reads the verification date from freshness.last_verified_on", () => {
    expect(parseProjectCard(usable).lastVerifiedOn).toBe("2026-10-08");
  });

  test("rejects a card without a verification date instead of defaulting it", () => {
    const { freshness: _omitted, ...withoutFreshness } = usable;
    expect(() => parseProjectCard(withoutFreshness)).toThrow(
      "project_card.last_verified_on_invalid:notebook",
    );
  });

  test("rejects a verification date that is not a real calendar day", () => {
    expect(() =>
      parseProjectCard({ ...usable, freshness: { last_verified_on: "2026-02-30" } }),
    ).toThrow("project_card.last_verified_on_invalid:notebook");
  });
});

describe("parseProjectCard (FR-02 : état lu, jamais saisi)", () => {
  test("reads exposure and maturity from the card", () => {
    const card = parseProjectCard(usable);
    expect(card.exposure).toBe("usable-verifiable");
    expect(card.maturity).toBe("usable");
  });

  test("rejects an exposure outside the I-15 scale", () => {
    expect(() => parseProjectCard({ ...usable, exposure: "discovery" })).toThrow(
      "project_card.exposure_invalid:notebook",
    );
  });

  test("rejects a maturity outside the schema enum", () => {
    expect(() => parseProjectCard({ ...usable, maturity: "stable" })).toThrow(
      "project_card.maturity_invalid:notebook",
    );
  });

  test("rejects a missing exposure instead of defaulting it", () => {
    const { exposure: _omitted, ...withoutExposure } = usable;
    expect(() => parseProjectCard(withoutExposure)).toThrow(
      "project_card.exposure_invalid:notebook",
    );
  });
});

describe("checkProjectCardGates (FR-02, FR-03)", () => {
  test("counts every card examined and reports none when clean", () => {
    const report = checkProjectCardGates([parseProjectCard(usable), parseProjectCard(idea)]);
    expect(report).toEqual({ examined: 2, violations: [] });
  });

  test("fails when an idea card carries an application URL (FR-02)", () => {
    const report = checkProjectCardGates([
      parseProjectCard({ ...idea, application_url: "https://sketch.example.test/" }),
    ]);
    expect(report.violations).toEqual(["fiche.application_url_forbidden:sketch"]);
  });

  test("fails when a spec-published card carries an application URL (FR-02)", () => {
    const report = checkProjectCardGates([
      parseProjectCard({
        ...idea,
        exposure: "spec-published",
        maturity: "specified",
        application_url: "https://sketch.example.test/",
      }),
    ]);
    expect(report.violations).toEqual(["fiche.application_url_forbidden:sketch"]);
  });

  test("allows an application URL for usable-verifiable and proven cards", () => {
    const report = checkProjectCardGates([
      parseProjectCard(usable),
      parseProjectCard({
        ...usable,
        project: "proven-one",
        exposure: "proven",
        maturity: "proven",
      }),
    ]);
    expect(report.violations).toEqual([]);
  });

  test("fails a card whose non_goals (Limites) is empty (FR-03)", () => {
    const report = checkProjectCardGates([parseProjectCard({ ...usable, non_goals: [] })]);
    expect(report.violations).toEqual(["fiche.limits_missing:notebook"]);
  });

  test("fails a card whose non_goals holds only blank entries (FR-03)", () => {
    const report = checkProjectCardGates([parseProjectCard({ ...usable, non_goals: ["   "] })]);
    expect(report.violations).toEqual(["fiche.limits_missing:notebook"]);
  });
});
