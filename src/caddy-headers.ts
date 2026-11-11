/**
 * Header contract of the static target (G6, ADR 0006 §2): the committed Caddyfile must declare
 * exactly the single policy of headers.ts, header by header. A missing, different or undeclared
 * header is a violation, and a Caddyfile without a header block fails rather than passing empty.
 */
import { SECURITY_HEADERS } from "./headers";

export interface HeaderReport {
  readonly examined: number;
  readonly violations: readonly string[];
}

function declaredHeaders(caddyfile: string): Map<string, string> | null {
  const block = /\bheader\s*\{([^}]*)\}/.exec(caddyfile)?.[1];
  if (block === undefined) return null;
  const headers = new Map<string, string>();
  for (const line of block.split("\n")) {
    const match = /^\s*([A-Za-z-]+)\s+"([^"]*)"\s*$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) headers.set(match[1], match[2]);
  }
  return headers;
}

export function checkSecurityHeaders(caddyfile: string): HeaderReport {
  const declared = declaredHeaders(caddyfile);
  if (declared === null) return { examined: 0, violations: ["header.block_missing"] };
  const violations: string[] = [];
  let examined = 0;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    examined += 1;
    const actual = declared.get(name);
    if (actual === undefined) violations.push(`header.missing:${name}`);
    else if (actual !== value) violations.push(`header.differs:${name}`);
  }
  for (const name of declared.keys()) {
    if (!(name in SECURITY_HEADERS)) violations.push(`header.undeclared:${name}`);
  }
  return { examined, violations };
}
