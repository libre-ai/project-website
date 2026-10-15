import { describe, expect, test } from "bun:test";

import { deployBody, parseDeployFacts } from "./deploy";

const SHA_A = "3c4e38605152fff7b5e6f94d5c1557ac94ea5956";
const SHA_B = "ed87f3fa5b9285adc08e7a07a94853872cb1bb16";
const doc = [
  "# Installer une composition locale",
  "```sh",
  "set -eu",
  "TARGET=personal-knowledge-workspace",
  `TARGET_REVISION=${SHA_A}`,
  `TOOLING_REVISION=${SHA_B}`,
  "```",
].join("\n");

describe("parseDeployFacts (S3.3)", () => {
  test("reads the target and the two revisions as written in the document", () => {
    expect(parseDeployFacts(doc)).toEqual({
      target: "personal-knowledge-workspace",
      targetRevision: SHA_A,
      toolingRevision: SHA_B,
    });
  });

  test("a missing constant refuses the build, naming it", () => {
    const without = doc.replace(/^TOOLING_REVISION=.*$/m, "");
    expect(() => parseDeployFacts(without)).toThrow("deploy.fact_missing:TOOLING_REVISION");
  });

  test("a revision that is not a full commit sha is refused", () => {
    expect(() => parseDeployFacts(doc.replace(SHA_A, "main"))).toThrow(
      "deploy.revision_invalid:TARGET_REVISION",
    );
  });
});

describe("deployBody", () => {
  const facts = {
    target: "personal-knowledge-workspace",
    targetRevision: SHA_A,
    toolingRevision: SHA_B,
  };
  const html = deployBody(facts, "c759ed3a711dcbd33591571978a32cdb04de7f57");

  test("cites each revision with its full sha", () => {
    expect(html).toContain(SHA_A);
    expect(html).toContain(SHA_B);
    expect(html).toContain("personal-knowledge-workspace");
  });

  test("links the source document at the pinned commit, not at a branch", () => {
    expect(html).toContain(
      "https://github.com/libre-ai/project-governance/blob/c759ed3a711dcbd33591571978a32cdb04de7f57/docs/LOCAL-COMPOSITION.md",
    );
    expect(html).not.toContain("/blob/HEAD/");
  });

  test("never presents a version as current", () => {
    for (const phrase of ["à jour", "dernière version", "latest", "recommandée"]) {
      expect(html.toLowerCase()).not.toContain(phrase);
    }
  });

  test("announces that it deploys nothing: a local composition only", () => {
    expect(html).toContain("composition locale");
    expect(html).not.toContain("<form");
  });
});
