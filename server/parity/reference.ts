/**
 * What the parity test executes as the reference (ADR-0063 D5 (c)): the Bun runtime, by exact
 * version and revision, and the files of the reference. Both are recorded in
 * `reference-fingerprint.json`: when one changes, the parity test fails until the recording is
 * renewed (`bun run parity:record`), so the port is never held to what the reference no longer
 * does. The runtime is part of it because the reference's answers depend on it: Bun 1.4.4
 * refuses addresses and hosts that 1.4.0-canary.1 accepts (measured on 2026-11-23, ADR 0009).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..", "..");
export const FINGERPRINT_PATH = "server/parity/reference-fingerprint.json";

export const REFERENCE_FILES = [
  "server/http.ts",
  "server/email.ts",
  "server/limiter.ts",
  "server/log.ts",
  "server/mailer.ts",
  "server/messages.ts",
  "server/purge.ts",
  "server/store.ts",
  "server/subscription.ts",
  "server/tokens.ts",
  "src/content/consent.ts",
  "src/content/universes.ts",
  "src/headers.ts",
  "src/security.ts",
] as const;

export interface Runtime {
  readonly version: string;
  readonly revision: string;
}

export interface Fingerprint {
  readonly runtime: Runtime;
  /** Path → SHA-256 of each reference file. */
  readonly files: Readonly<Record<string, string>>;
}

/** The Bun running this process. */
export function currentRuntime(): Runtime {
  return { version: Bun.version, revision: Bun.revision };
}

/** The fingerprint of the reference under `runtime`; an unreadable file throws, never counts as empty. */
export async function fingerprint(runtime: Runtime = currentRuntime()): Promise<Fingerprint> {
  const files: Record<string, string> = {};
  for (const path of REFERENCE_FILES) {
    const content = await readFile(join(ROOT, path));
    files[path] = createHash("sha256").update(content).digest("hex");
  }
  return { runtime, files };
}

export function renderFingerprint(recorded: Fingerprint): string {
  return `${JSON.stringify({ runtime: recorded.runtime, files: recorded.files }, null, 2)}\n`;
}
