import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { SECURITY_HEADERS } from "../src/headers";
import { renderServerPolicy, SERVER_POLICY_PATH, serverPolicy } from "./server-policy";

const ROOT = join(import.meta.dir, "..");

describe("policy shared with the Rust server (ADR 0009)", () => {
  test("the embedded file is the render of its TypeScript sources", async () => {
    // An absent file fails here: the binary would not build without it either.
    const committed = await readFile(join(ROOT, SERVER_POLICY_PATH), "utf8");
    expect(committed).toBe(renderServerPolicy());
  });

  test("the render carries every header, universe and application reference", () => {
    const policy = serverPolicy();
    expect(policy.securityHeaders).toHaveLength(Object.keys(SECURITY_HEADERS).length);
    expect(policy.universes).toContain("apprendre");
    expect(policy.follow).toContain("P07");
    expect(policy.follow).not.toContain("constructor");
  });
});
