/**
 * Confirmation and unsubscribe tokens (ADR 0006 §3). A token travels only in the message sent to
 * the subscriber; the database keeps its SHA-256 digest, so a read of the table cannot confirm or
 * unsubscribe anyone.
 */
import { createHash } from "node:crypto";

const TOKEN_BYTES = 32;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newToken(): { readonly token: string; readonly hash: string } {
  const random = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  const token = Buffer.from(random).toString("base64url");
  return { token, hash: hashToken(token) };
}
