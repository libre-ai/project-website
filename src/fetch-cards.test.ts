import { describe, expect, test } from "bun:test";

import cardSources from "./data/card-sources.json";
import { cardUrl, parseCardSources } from "./fetch-cards";

const sha = "a".repeat(40);

describe("parseCardSources (G2 : chaque lecture est épinglée à un SHA)", () => {
  test("accepts a repository with a full 40-character commit", () => {
    expect(parseCardSources([{ repository: "execution-sandbox", sha }])).toEqual([
      { repository: "execution-sandbox", sha },
    ]);
  });

  test("refuses a branch name where a commit is required", () => {
    expect(() =>
      parseCardSources([{ repository: "execution-sandbox", sha: "migrate/recover-code" }]),
    ).toThrow("card_sources.sha_invalid:execution-sandbox");
  });

  test("refuses an empty list instead of fetching nothing", () => {
    expect(() => parseCardSources([])).toThrow("card_sources.empty");
  });

  test("refuses a repository name that could escape the API path", () => {
    expect(() => parseCardSources([{ repository: "../other", sha }])).toThrow(
      "card_sources.repository_invalid:0",
    );
  });

  test("the committed pins are all valid", () => {
    expect(parseCardSources(cardSources)).toHaveLength(15);
  });
});

describe("cardUrl", () => {
  test("names the file at the pinned commit, never at a branch", () => {
    expect(cardUrl({ repository: "execution-sandbox", sha })).toBe(
      `repos/libre-ai/execution-sandbox/contents/project.v1.yaml?ref=${sha}`,
    );
  });
});
