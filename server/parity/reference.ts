/**
 * The files of the Bun reference that the parity test executes (ADR-0063 D5 (c)). Their digests
 * are recorded in `reference-fingerprint.json`: when one changes, the parity test fails until the
 * recording is renewed (`bun run parity:record`), so the port is never held to what the
 * reference no longer does.
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

/** Path → SHA-256 of each reference file; an unreadable file throws, never counts as empty. */
export async function fingerprint(): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  for (const path of REFERENCE_FILES) {
    const content = await readFile(join(ROOT, path));
    digests[path] = createHash("sha256").update(content).digest("hex");
  }
  return digests;
}

export function renderFingerprint(digests: Record<string, string>): string {
  return `${JSON.stringify({ files: digests }, null, 2)}\n`;
}
