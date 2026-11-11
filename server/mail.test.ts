import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createOutboxMailer } from "./mailer";
import { confirmationMessage, toRfc5322 } from "./messages";

const input = {
  from: "Libre IA <liste@libre-ia.example>",
  to: "a@example.org",
  confirmUrl: "https://libre-ia.example/confirmer?jeton=abc",
  unsubscribeUrl: "https://libre-ia.example/desinscrire?jeton=def",
};
const date = new Date("2026-11-11T10:00:00.000Z");

describe("confirmation message (ADR 0006 §4)", () => {
  const message = confirmationMessage(input);

  test("is addressed and carries both links", () => {
    expect(message.from).toBe(input.from);
    expect(message.to).toBe(input.to);
    expect(message.subject).toBe("Confirmez votre inscription à Libre IA");
    expect(message.text).toContain(input.confirmUrl);
    expect(message.text).toContain(input.unsubscribeUrl);
    expect(message.text).toContain("48 heures");
  });

  test("carries one-click unsubscribe headers (RFC 8058)", () => {
    expect(message.headers).toEqual({
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});

describe("toRfc5322", () => {
  const raw = toRfc5322(confirmationMessage(input), date, "<id-1@libre-ia.example>");
  // Only the first empty line separates the header from the body.
  const separator = raw.indexOf("\r\n\r\n");
  const head = raw.slice(0, separator);
  const body = raw.slice(separator + 4);

  test("separates header and body with CRLF and ends lines with CRLF only", () => {
    expect(raw).not.toMatch(/[^\r]\n/);
    expect(head.split("\r\n")).toContain("MIME-Version: 1.0");
    expect(body).toContain(input.confirmUrl);
  });

  test("writes the date in RFC 5322 form and the message id as given", () => {
    expect(head).toContain("Date: Wed, 11 Nov 2026 10:00:00 +0000");
    expect(head).toContain("Message-ID: <id-1@libre-ia.example>");
  });

  test("encodes a non-ASCII subject (RFC 2047) and declares UTF-8 text", () => {
    const subject = head.split("\r\n").find((line) => line.startsWith("Subject: ")) ?? "";
    expect(subject).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    const encoded = subject.slice("Subject: =?UTF-8?B?".length, -2);
    expect(Buffer.from(encoded, "base64").toString("utf8")).toBe(
      "Confirmez votre inscription à Libre IA",
    );
    expect(head).toContain("Content-Type: text/plain; charset=utf-8");
  });

  test("refuses a CR or LF in any header value", () => {
    const injected = confirmationMessage({ ...input, to: "a@example.org\r\nBcc: b@example.org" });
    expect(() => toRfc5322(injected, date, "<id@libre-ia.example>")).toThrow(
      "mail.header_injection",
    );
    const viaUrl = confirmationMessage({ ...input, unsubscribeUrl: "https://x.example/\nBcc: b" });
    expect(() => toRfc5322(viaUrl, date, "<id@libre-ia.example>")).toThrow("mail.header_injection");
  });
});

describe("outbox mailer (local demo)", () => {
  let directory = "";

  afterEach(async () => {
    if (directory !== "") await rm(directory, { recursive: true, force: true });
  });

  test("writes one RFC 5322 file per message, in order", async () => {
    directory = await mkdtemp(join(tmpdir(), "outbox-"));
    const mailer = createOutboxMailer(directory, () => date);
    await mailer.send(confirmationMessage(input));
    await mailer.send(confirmationMessage({ ...input, to: "b@example.org" }));
    const files = (await readdir(directory)).sort();
    expect(files).toHaveLength(2);
    expect(files.every((name) => name.endsWith(".eml"))).toBe(true);
    const second = await readFile(join(directory, files[1] ?? ""), "utf8");
    expect(second).toContain("To: b@example.org\r\n");
  });

  test("dates each message with the current time by default", async () => {
    directory = await mkdtemp(join(tmpdir(), "outbox-"));
    const before = Date.now();
    await createOutboxMailer(directory).send(confirmationMessage(input));
    const [file = ""] = await readdir(directory);
    const raw = await readFile(join(directory, file), "utf8");
    const header = /^Date: (.+)$/m.exec(raw)?.[1]?.trim() ?? "";
    expect(Date.parse(header)).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
  });

  test("refuses a sender without an address, writing nothing", async () => {
    directory = await mkdtemp(join(tmpdir(), "outbox-"));
    const mailer = createOutboxMailer(directory, () => date);
    await expect(mailer.send(confirmationMessage({ ...input, from: "Libre IA" }))).rejects.toThrow(
      "mail.sender_invalid",
    );
    expect(await readdir(directory)).toEqual([]);
  });
});
