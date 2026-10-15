import { describe, expect, test } from "bun:test";

import cardSources from "./data/card-sources.json";
import { parsePinnedSources } from "./fetch-cards";

const sha = "a".repeat(40);
const sha256 = "b".repeat(64);

describe("parsePinnedSources (G2 : chaque lecture est épinglée à un SHA et à une empreinte)", () => {
  test("accepts a repository with a full commit and a SHA-256 digest", () => {
    expect(parsePinnedSources([{ repository: "execution-sandbox", sha, sha256 }])).toEqual([
      { repository: "execution-sandbox", sha, sha256 },
    ]);
  });

  test("refuses a branch name where a commit is required", () => {
    expect(() =>
      parsePinnedSources([
        { repository: "execution-sandbox", sha: "migrate/recover-code", sha256 },
      ]),
    ).toThrow("pinned_sources.sha_invalid:execution-sandbox");
  });

  test("refuses a pin without the digest of the fetched file", () => {
    expect(() => parsePinnedSources([{ repository: "execution-sandbox", sha }])).toThrow(
      "pinned_sources.sha256_invalid:execution-sandbox",
    );
  });

  test("refuses an empty list instead of fetching nothing", () => {
    expect(() => parsePinnedSources([])).toThrow("pinned_sources.empty");
  });

  test("refuses a repository name that could escape the API path", () => {
    expect(() => parsePinnedSources([{ repository: "../other", sha, sha256 }])).toThrow(
      "pinned_sources.repository_invalid:0",
    );
  });

  test("the committed pins are all valid", () => {
    expect(parsePinnedSources(cardSources)).toHaveLength(15);
  });
});

// The URL of a pinned file is covered by fetch-pinned.test.ts (pinnedUrl).
