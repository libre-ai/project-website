/**
 * Sending waitlist messages (ADR 0006 §7). This milestone ships the interface and a local outbox
 * that writes each message as an RFC 5322 file, which the demo and the end-to-end tests read.
 * shortcut: no SMTP transport yet, upgrade trigger: the deployment milestone (Infomaniak SMTP,
 * secret through request_secret).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { type MailMessage, toRfc5322 } from "./messages";

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

function senderDomain(from: string): string {
  const domain = /@([^>\s]+)>?\s*$/.exec(from)?.[1];
  if (domain === undefined) throw new Error("mail.sender_invalid");
  return domain;
}

export function createOutboxMailer(
  directory: string,
  clock: () => Date = () => new Date(),
): Mailer {
  let sequence = 0;
  return {
    async send(message) {
      sequence += 1;
      const date = clock();
      const messageId = `<${crypto.randomUUID()}@${senderDomain(message.from)}>`;
      const stamp = date.toISOString().replaceAll(":", "-");
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, `${String(sequence).padStart(4, "0")}-${stamp}.eml`),
        toRfc5322(message, date, messageId),
        "utf8",
      );
    },
  };
}
