import { describe, expect, test } from "bun:test";

import { pinnedUrl } from "./fetch-pinned";

const source = {
  repository: "execution-sandbox",
  sha: "a".repeat(40),
  sha256: "b".repeat(64),
};

describe("pinnedUrl", () => {
  test("addresses the file at the pinned commit, never at a branch name", () => {
    expect(pinnedUrl(source, "REUSE.toml")).toBe(
      `repos/libre-ai/execution-sandbox/contents/REUSE.toml?ref=${"a".repeat(40)}`,
    );
  });

  test("keeps nested paths", () => {
    expect(pinnedUrl(source, "docs/LOCAL-COMPOSITION.md")).toContain(
      "/contents/docs/LOCAL-COMPOSITION.md?ref=",
    );
  });

  test("refuses a path that is empty, absolute or climbs out of the repository", () => {
    for (const path of ["", "/REUSE.toml", "../x", "a/../b", "a?ref=main"]) {
      expect(() => pinnedUrl(source, path), path).toThrow("pinned_fetch.path_invalid");
    }
  });
});
