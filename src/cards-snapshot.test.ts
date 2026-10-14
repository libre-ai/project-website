import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { sha256Hex, verifyCardSnapshot } from "./cards-snapshot";
import cardSources from "./data/card-sources.json";
import { parseCardSources } from "./fetch-cards";

const sha = "a".repeat(40);
const text = "project: sketch\nexposure: idea\n";
const source = { repository: "sketch", sha, sha256: sha256Hex(text) };

describe("verifyCardSnapshot (G2 : la copie versionnée égale la source épinglée)", () => {
  test("passes when every pinned card is present with the recorded digest", () => {
    expect(verifyCardSnapshot([source], [{ repository: "sketch", text }])).toEqual({
      examined: 1,
      violations: [],
    });
  });

  test("fails a card edited by hand: the digest no longer matches", () => {
    const report = verifyCardSnapshot([source], [{ repository: "sketch", text: `${text}x` }]);
    expect(report.violations).toEqual(["snapshot.digest_mismatch:sketch"]);
  });

  test("fails a pinned card that is missing from the snapshot", () => {
    expect(verifyCardSnapshot([source], []).violations).toEqual(["snapshot.missing:sketch"]);
  });

  test("fails a snapshot file that no pin covers", () => {
    const report = verifyCardSnapshot(
      [source],
      [
        { repository: "sketch", text },
        { repository: "ghost", text: "project: ghost\n" },
      ],
    );
    expect(report.violations).toEqual(["snapshot.unpinned:ghost"]);
  });
});

describe("the committed snapshot", () => {
  test("every committed card matches the digest recorded for its pinned commit", async () => {
    const directory = join(import.meta.dir, "data/cards");
    const names = (await readdir(directory)).filter((name) => name.endsWith(".project.v1.yaml"));
    const files = await Promise.all(
      names.map(async (name) => ({
        repository: name.replace(".project.v1.yaml", ""),
        text: await readFile(join(directory, name), "utf8"),
      })),
    );
    const report = verifyCardSnapshot(parseCardSources(cardSources), files);
    expect(report.violations).toEqual([]);
    expect(report.examined).toBe(15);
    expect(files).toHaveLength(15);
  });
});
