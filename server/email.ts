/**
 * Email address normalisation for the waitlist (ADR 0006 §3). Two writings of the same address
 * must map to one row, and nothing that could break a mail header may pass. Only the domain is
 * case-folded: RFC 5321 leaves the local part's case to the receiving server, so lowercasing it
 * could merge two different mailboxes.
 */
import { domainToASCII } from "node:url";

const MAX_ADDRESS_BYTES = 254;
const MAX_LOCAL_BYTES = 64;
// Control characters and any whitespace: they would allow header injection or hide a second address.
function hasForbiddenCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || /\s/.test(character)) return true;
  }
  return false;
}

const bytes = (value: string): number => new TextEncoder().encode(value).length;

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim();
  if (hasForbiddenCharacter(trimmed)) return null;
  const parts = trimmed.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (local === undefined || domain === undefined || local === "" || domain === "") return null;
  if (bytes(local) > MAX_LOCAL_BYTES) return null;
  const ascii = domainToASCII(domain.toLowerCase());
  if (ascii === "" || !ascii.includes(".") || ascii.split(".").some((label) => label === "")) {
    return null;
  }
  const address = `${local}@${ascii}`;
  return bytes(address) > MAX_ADDRESS_BYTES ? null : address;
}
