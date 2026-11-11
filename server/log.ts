/**
 * Structured server log (ADR 0006 §6): one JSON line per event, holding an event name and counts
 * or codes. No address, token or client IP is ever passed; as a last barrier, any value shaped
 * like an email address is redacted before it is written.
 */

export interface Logger {
  event(name: string, fields?: Readonly<Record<string, number | string>>): void;
}

const REDACTED = "[retiré]";

export function createLogger(write: (line: string) => void): Logger {
  return {
    event(name, fields = {}) {
      const safe = Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key,
          typeof value === "string" && value.includes("@") ? REDACTED : value,
        ]),
      );
      write(JSON.stringify({ event: name, ...safe }));
    },
  };
}
