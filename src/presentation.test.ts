import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AUTHOR_PLACEHOLDER, loadPresentations, parsePresentation } from "./presentation";

const draft = {
  project: "sketch",
  title: "Sketch",
  author: AUTHOR_PLACEHOLDER,
  ai_assistance: "Brouillon rédigé par un modèle de langage ; relecture humaine requise.",
  nature: "analyse",
  review_date: "2026-10-14",
  reviewed: false,
  pitch: "Sketch décrit vos contraintes et vous propose un plan.",
  capabilities: ["Décrire des contraintes.", "Comparer un plan aux faits."],
  audience: "Toute personne qui prépare un déplacement.",
};

describe("parsePresentation (ADR 0003, FR-04)", () => {
  test("accepts a draft with the placeholder author while unreviewed", () => {
    const presentation = parsePresentation(draft);
    expect(presentation.reviewed).toBe(false);
    expect(presentation.capabilities).toHaveLength(2);
  });

  test("refuses a reviewed presentation that still carries the placeholder author", () => {
    expect(() => parsePresentation({ ...draft, reviewed: true })).toThrow(
      "presentation.reviewed_without_author:sketch",
    );
  });

  test("accepts a reviewed presentation signed by a named human", () => {
    expect(
      parsePresentation({ ...draft, reviewed: true, author: "Relecteur nommé" }).reviewed,
    ).toBe(true);
  });

  test.each([
    "author",
    "ai_assistance",
    "nature",
    "review_date",
  ])("refuses a presentation without %s (FR-04)", (field) => {
    const { [field]: _omitted, ...rest } = draft;
    expect(() => parsePresentation(rest)).toThrow(`resource.${field}_invalid:Sketch`);
  });

  test("refuses an empty capability list", () => {
    expect(() => parsePresentation({ ...draft, capabilities: [] })).toThrow(
      "presentation.capabilities_invalid:sketch",
    );
  });

  test("refuses a reviewed flag that is not a boolean", () => {
    expect(() => parsePresentation({ ...draft, reviewed: "yes" })).toThrow(
      "presentation.reviewed_invalid:sketch",
    );
  });
});

describe("loadPresentations", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "presentations-"));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("reads every presentation file and ignores other files", async () => {
    const dir = join(root, "ok");
    await mkdir(dir);
    await writeFile(join(dir, "sketch.presentation.yaml"), Bun.YAML.stringify(draft));
    await writeFile(join(dir, "README.md"), "pas une présentation");
    expect(await loadPresentations(dir)).toHaveLength(1);
  });

  test("fails closed when the directory is missing", async () => {
    await expect(loadPresentations(join(root, "absent"))).rejects.toThrow(
      "presentations.source_unreadable",
    );
  });

  test("fails closed on a malformed presentation instead of skipping it", async () => {
    const dir = join(root, "broken");
    await mkdir(dir);
    await writeFile(join(dir, "bad.presentation.yaml"), "project: bad\n");
    await expect(loadPresentations(dir)).rejects.toThrow("resource.");
  });
});
