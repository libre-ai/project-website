import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  currentRuntime,
  FINGERPRINT_PATH,
  fingerprint,
  REFERENCE_FILES,
  ROOT,
  renderFingerprint,
} from "./reference";

describe("fingerprint of the parity reference", () => {
  test("covers the exact Bun runtime and every reference file", async () => {
    const recorded = await fingerprint();
    expect(recorded.runtime).toEqual({ version: Bun.version, revision: Bun.revision });
    expect(Object.keys(recorded.files)).toEqual([...REFERENCE_FILES]);
    expect(Object.values(recorded.files).every((digest) => /^[0-9a-f]{64}$/.test(digest))).toBe(
      true,
    );
  });

  test("another Bun, even of the same version, renders another fingerprint", async () => {
    const pinned = renderFingerprint(await fingerprint());
    const sameVersion = { version: currentRuntime().version, revision: "0".repeat(40) };
    expect(renderFingerprint(await fingerprint(sameVersion))).not.toBe(pinned);
    const otherVersion = { version: "1.4.4", revision: currentRuntime().revision };
    expect(renderFingerprint(await fingerprint(otherVersion))).not.toBe(pinned);
  });

  test("the recording names the runtime it was made under", async () => {
    const recorded = JSON.parse(await readFile(join(ROOT, FINGERPRINT_PATH), "utf8")) as {
      runtime?: { version?: unknown; revision?: unknown };
    };
    expect(typeof recorded.runtime?.version).toBe("string");
    expect(recorded.runtime?.revision).toMatch(/^[0-9a-f]{40}$/);
  });
});
