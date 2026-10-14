import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadProjectCards } from "./cards-source";

const card = (project: string) =>
  [
    `schema_version: "1.0"`,
    `project: ${project}`,
    `repository: libre-ai/${project}`,
    `exposure: idea`,
    `maturity: idea`,
    `summary: "Résumé court."`,
    `current_situation: "Aucun code n'existe encore à ce stade."`,
    `non_goals:`,
    `  - "Pas d'engagement de date."`,
    "",
  ].join("\n");

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "cards-source-"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("loadProjectCards (G2 : fiches lues, jamais zéro silencieux)", () => {
  test("reads every card file and reports the count it read", async () => {
    const dir = join(root, "ok");
    await mkdir(dir);
    await writeFile(join(dir, "notebook.project.v1.yaml"), card("notebook"));
    await writeFile(join(dir, "sketch.project.v1.yaml"), card("sketch"));
    const result = await loadProjectCards(dir);
    expect(result.read).toBe(2);
    expect(result.cards.map((entry) => entry.project).sort()).toEqual(["notebook", "sketch"]);
  });

  test("fails closed when the source directory is missing", async () => {
    await expect(loadProjectCards(join(root, "absent"))).rejects.toThrow("cards.source_unreadable");
  });

  test("fails closed on a malformed card instead of skipping it", async () => {
    const dir = join(root, "broken");
    await mkdir(dir);
    await writeFile(join(dir, "good.project.v1.yaml"), card("good"));
    await writeFile(join(dir, "bad.project.v1.yaml"), "exposure: discovery\n");
    await expect(loadProjectCards(dir)).rejects.toThrow("project_card.");
  });

  test("ignores files that are not project cards", async () => {
    const dir = join(root, "mixed");
    await mkdir(dir);
    await writeFile(join(dir, "notes.md"), "pas une fiche");
    await writeFile(join(dir, "only.project.v1.yaml"), card("only"));
    const result = await loadProjectCards(dir);
    expect(result.read).toBe(1);
  });
});
