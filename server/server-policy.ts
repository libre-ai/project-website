/**
 * The values the Rust server shares with the site (ADR 0009): the security header policy, the
 * consent text version, the universes and the application references of the waitlist form. They
 * are defined once, here in TypeScript, and written to `crates/site-server/policy.json`, which
 * the binary embeds. `server/server-policy.test.ts` fails when the file differs from this render.
 * Refresh: `bun run sync:server-policy`.
 */
import { CONSENT_TEXT_VERSION } from "../src/content/consent";
import { UNIVERSE_OF, UNIVERSES } from "../src/content/universes";
import { SECURITY_HEADERS } from "../src/headers";

export const SERVER_POLICY_PATH = "crates/site-server/policy.json";

export interface ServerPolicy {
  readonly securityHeaders: readonly (readonly [string, string])[];
  readonly consentTextVersion: string;
  readonly universes: readonly string[];
  readonly follow: readonly string[];
}

export function serverPolicy(): ServerPolicy {
  return {
    securityHeaders: Object.entries(SECURITY_HEADERS),
    consentTextVersion: CONSENT_TEXT_VERSION,
    universes: UNIVERSES.map((universe) => universe.id),
    follow: Object.keys(UNIVERSE_OF).sort(),
  };
}

export function renderServerPolicy(policy: ServerPolicy = serverPolicy()): string {
  return `${JSON.stringify(policy, null, 2)}\n`;
}
