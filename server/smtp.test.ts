import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { connect, createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";

import { senderAddress } from "./mailer";
import { confirmationMessage, type MailMessage, toRfc5322 } from "./messages";
import { createSmtpMailer, type SmtpConfig, type SmtpDial } from "./smtp";

const date = new Date("2026-11-11T10:00:00.000Z");
const message = confirmationMessage({
  from: "Libre IA <liste@libre-ia.example>",
  to: "a@example.org",
  confirmUrl: "https://libre-ia.example/confirmer?jeton=abc",
  unsubscribeUrl: "https://libre-ia.example/desinscrire?jeton=def",
});
const TLS_HANDSHAKE_RECORD = 0x16;
const ENVELOPE_COMMAND = /^(MAIL FROM|RCPT TO|DATA)/;

interface Script {
  /** `silent` never greets, `leave` greets then closes. */
  readonly greeting?: "greet" | "silent" | "leave";
  readonly starttls?: boolean;
  /** Raw answer to STARTTLS, `220 go\r\n` when absent. */
  readonly starttlsReply?: string;
  readonly ehloReply?: string;
  readonly rcptReply?: string;
}

/** A scripted relay on the loopback interface, on a port chosen by the system. */
class StubRelay {
  connections = 0;
  readonly commands: string[] = [];
  readonly contents: string[] = [];
  /** First byte received when no SMTP command was expected: at opening, or after STARTTLS. */
  readonly rawFirstBytes: number[] = [];
  readonly dialled: { port: number; host: string }[] = [];
  readonly #server: Server;
  readonly #script: Script;
  readonly #open = new Set<Socket>();
  #idle: (() => void) | undefined;

  private constructor(server: Server, script: Script) {
    this.#server = server;
    this.#script = script;
    server.on("connection", (socket) => this.#accept(socket));
  }

  static async start(script: Script = {}): Promise<StubRelay> {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return new StubRelay(server, script);
  }

  get port(): number {
    const address = this.#server.address();
    if (address === null || typeof address === "string") throw new Error("stub.not_listening");
    return address.port;
  }

  /** Records the port and host the transport asked for, and connects to the stub instead. */
  readonly dial: SmtpDial = (port, host) => {
    this.dialled.push({ port, host });
    return connect(this.port, "127.0.0.1");
  };

  /** Resolves once every accepted connection is closed. */
  settled(): Promise<void> {
    if (this.#open.size === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.#idle = resolve;
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.#open) socket.destroy();
    await new Promise<void>((resolve) => this.#server.close(() => resolve()));
  }

  #accept(socket: Socket): void {
    this.connections += 1;
    this.#open.add(socket);
    socket.on("error", () => undefined);
    socket.on("close", () => {
      this.#open.delete(socket);
      if (this.#open.size === 0) this.#idle?.();
    });
    const greeting = this.#script.greeting ?? "greet";
    let raw = greeting === "silent";
    let inData = false;
    let buffer = "";
    socket.on("data", (chunk: Buffer) => {
      if (raw) {
        this.rawFirstBytes.push(chunk[0] ?? -1);
        socket.destroy();
        return;
      }
      buffer += chunk.toString("utf8");
      for (;;) {
        const end = buffer.indexOf(inData ? "\r\n.\r\n" : "\r\n");
        if (end === -1) return;
        if (inData) {
          this.contents.push(buffer.slice(0, end + 5));
          buffer = buffer.slice(end + 5);
          inData = false;
          socket.write("250 queued\r\n");
          continue;
        }
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        this.commands.push(line);
        if (line.startsWith("EHLO ")) {
          socket.write(
            this.#script.ehloReply ??
              `250-stub.example\r\n250 ${this.#script.starttls === true ? "STARTTLS" : "SIZE 1000"}\r\n`,
          );
        } else if (line === "STARTTLS") {
          raw = true;
          socket.write(this.#script.starttlsReply ?? "220 go\r\n");
        } else if (line.startsWith("AUTH ")) socket.write("235 authenticated\r\n");
        else if (line.startsWith("RCPT ")) socket.write(this.#script.rcptReply ?? "250 ok\r\n");
        else if (line === "DATA") {
          inData = true;
          socket.write("354 go ahead\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
    if (greeting === "leave") socket.end("220 stub.example ESMTP\r\n");
    else if (greeting === "greet") socket.write("220 stub.example ESMTP\r\n");
  }
}

let relay: StubRelay | undefined;

async function stub(script: Script = {}): Promise<StubRelay> {
  relay = await StubRelay.start(script);
  return relay;
}

afterEach(async () => {
  await relay?.stop();
  relay = undefined;
});

function mailer(target: StubRelay, config: Partial<SmtpConfig> = {}) {
  return createSmtpMailer(
    { host: "127.0.0.1", timeoutMs: 2000, clock: () => date, ...config },
    target.dial,
  );
}

const local = { allowInsecureLocal: true } as const;

describe("configuration", () => {
  const build = (config: Partial<SmtpConfig>) => () =>
    createSmtpMailer({ host: "smtp.example.org", ...config });

  test("requires a host", () => {
    expect(() => createSmtpMailer({} as SmtpConfig)).toThrow("mail.smtp_host_missing");
    expect(build({ host: "" })).toThrow("mail.smtp_host_missing");
  });

  test("requires an integer port between 1 and 65535", () => {
    for (const port of [0, 70_000, 1.5]) expect(build({ port })).toThrow("mail.smtp_port_invalid");
    for (const port of [1, 25, 465, 587, 65_535]) expect(build({ port })).not.toThrow();
  });

  test("requires the user and the password together", () => {
    expect(build({ user: "u" })).toThrow("mail.smtp_auth_incomplete");
    expect(build({ password: "p" })).toThrow("mail.smtp_auth_incomplete");
    expect(build({ user: "u", password: "p" })).not.toThrow();
  });

  test("accepts the clear-text way out for a loopback host only", () => {
    expect(build({ ...local })).toThrow("mail.smtp_insecure_not_local");
    expect(build({ ...local, host: "127.0.0.2" })).toThrow("mail.smtp_insecure_not_local");
    for (const host of ["localhost", "LOCALHOST", "127.0.0.1", "::1"]) {
      expect(build({ ...local, host })).not.toThrow();
    }
  });
});

describe("sender address", () => {
  test("reads the address of both written forms", () => {
    expect(senderAddress("Libre IA <liste@libre-ia.example>")).toBe("liste@libre-ia.example");
    expect(senderAddress(" liste@libre-ia.example ")).toBe("liste@libre-ia.example");
  });

  test("refuses a sender without an address, or one that would extend the command", () => {
    for (const from of ["Libre IA", "", "Libre IA <>", "a@b> SIZE=1", "<a@b c>", "a@b\r\nc@d"]) {
      expect(() => senderAddress(from)).toThrow("mail.sender_invalid");
    }
  });
});

describe("encryption is required", () => {
  test("default port: a relay without STARTTLS gets no envelope and no content", async () => {
    const target = await stub();
    await expect(mailer(target).send(message)).rejects.toThrow("mail.smtp_starttls_unavailable");
    await target.settled();
    expect(target.dialled).toEqual([{ port: 587, host: "127.0.0.1" }]);
    expect(target.commands).toEqual(["EHLO libre-ia.example"]);
    expect(target.commands.filter((line) => ENVELOPE_COMMAND.test(line))).toEqual([]);
    expect(target.contents).toEqual([]);
  });

  test("port 25: same refusal", async () => {
    const target = await stub();
    await expect(mailer(target, { port: 25 }).send(message)).rejects.toThrow(
      "mail.smtp_starttls_unavailable",
    );
    await target.settled();
    expect(target.dialled).toEqual([{ port: 25, host: "127.0.0.1" }]);
    expect(target.commands).toEqual(["EHLO libre-ia.example"]);
    expect(target.contents).toEqual([]);
  });

  test("port 587: STARTTLS is sent, then the next byte opens a TLS handshake", async () => {
    const target = await stub({ starttls: true });
    // The stub has no certificate: it drops the connection once it has seen the handshake open.
    await expect(mailer(target, { port: 587 }).send(message)).rejects.toThrow(
      "mail.smtp_connection_failed",
    );
    await target.settled();
    expect(target.commands).toEqual(["EHLO libre-ia.example", "STARTTLS"]);
    expect(target.rawFirstBytes).toEqual([TLS_HANDSHAKE_RECORD]);
  });

  test("port 465: the first byte opens a TLS handshake, before any greeting", async () => {
    const target = await stub({ greeting: "silent" });
    await expect(mailer(target, { port: 465 }).send(message)).rejects.toThrow(
      "mail.smtp_connection_failed",
    );
    await target.settled();
    expect(target.rawFirstBytes).toEqual([TLS_HANDSHAKE_RECORD]);
    expect(target.commands).toEqual([]);
  });

  test("port 465: the clear-text way out changes nothing", async () => {
    const target = await stub({ greeting: "silent" });
    await expect(mailer(target, { port: 465, ...local }).send(message)).rejects.toThrow(
      "mail.smtp_connection_failed",
    );
    await target.settled();
    expect(target.rawFirstBytes).toEqual([TLS_HANDSHAKE_RECORD]);
    expect(target.commands).toEqual([]);
  });

  test("a loopback relay that offers STARTTLS is encrypted even with the way out", async () => {
    const target = await stub({ starttls: true });
    await expect(mailer(target, local).send(message)).rejects.toThrow(
      "mail.smtp_connection_failed",
    );
    await target.settled();
    expect(target.commands).toEqual(["EHLO libre-ia.example", "STARTTLS"]);
    expect(target.rawFirstBytes).toEqual([TLS_HANDSHAKE_RECORD]);
  });

  test("a reply slipped in after the STARTTLS go-ahead is refused, not read", async () => {
    const target = await stub({ starttls: true, starttlsReply: "220 go\r\n250 injected\r\n" });
    await expect(mailer(target).send(message)).rejects.toThrow("mail.smtp_rejected");
    await target.settled();
    expect(target.rawFirstBytes).toEqual([]);
    expect(target.commands).toEqual(["EHLO libre-ia.example", "STARTTLS"]);
  });
});

describe("dialogue in clear with a loopback relay", () => {
  test("sends the envelope, then the RFC 5322 content, then QUIT", async () => {
    const target = await stub();
    await mailer(target, local).send(message);
    await target.settled();
    expect(target.commands).toEqual([
      "EHLO libre-ia.example",
      "MAIL FROM:<liste@libre-ia.example>",
      "RCPT TO:<a@example.org>",
      "DATA",
      "QUIT",
    ]);
    const [content = ""] = target.contents;
    const messageId = /^Message-ID: (.+)$/m.exec(content)?.[1]?.trim() ?? "";
    expect(messageId).toMatch(/^<[0-9a-f-]{36}@libre-ia\.example>$/);
    expect(target.contents).toEqual([`${toRfc5322(message, date, messageId)}.\r\n`]);
  });

  test("uses the system connection and the current time by default", async () => {
    const target = await stub();
    const before = Date.now();
    await createSmtpMailer({ host: "127.0.0.1", port: target.port, ...local }).send(message);
    await target.settled();
    expect(target.connections).toBe(1);
    const header = /^Date: (.+)$/m.exec(target.contents[0] ?? "")?.[1]?.trim() ?? "";
    expect(Date.parse(header)).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
  });

  test("authenticates with AUTH PLAIN when credentials are given", async () => {
    const target = await stub();
    await mailer(target, { ...local, user: "liste", password: "s3cret" }).send(message);
    await target.settled();
    const expected = Buffer.from("\0liste\0s3cret", "utf8").toString("base64");
    expect(target.commands.slice(0, 3)).toEqual([
      "EHLO libre-ia.example",
      `AUTH PLAIN ${expected}`,
      "MAIL FROM:<liste@libre-ia.example>",
    ]);
  });

  test("sends no AUTH command without credentials", async () => {
    const target = await stub();
    await mailer(target, local).send(message);
    await target.settled();
    expect(target.commands.filter((line) => line.startsWith("AUTH"))).toEqual([]);
  });

  test("doubles a leading dot and ends the content with CRLF.CRLF", async () => {
    const target = await stub();
    const dotted: MailMessage = { ...message, text: "first\n.\n.hidden\nlast" };
    await mailer(target, local).send(dotted);
    await target.settled();
    const [content = ""] = target.contents;
    expect(content.endsWith("\r\n\r\nfirst\r\n..\r\n..hidden\r\nlast\r\n.\r\n")).toBe(true);
    expect(target.commands.at(-1)).toBe("QUIT");
  });

  test("leaves no bare CR a relay could read as the end of the content", async () => {
    const target = await stub();
    await mailer(target, local).send({ ...message, text: "a\r.\rb\n" });
    await target.settled();
    expect(target.contents).toHaveLength(1);
    expect(target.contents[0]?.endsWith("\r\n\r\na\r\n..\r\nb\r\n.\r\n")).toBe(true);
    expect(target.contents[0]).not.toMatch(/\r(?!\n)/);
  });
});

describe("refused before any connection", () => {
  const cases: [string, MailMessage, string][] = [
    ["a sender without an address", { ...message, from: "Libre IA" }, "mail.sender_invalid"],
    [
      "a line break in a header",
      { ...message, headers: { "List-Unsubscribe": "<https://x.example/>\r\nBcc: b@example.org" } },
      "mail.header_injection",
    ],
    [
      "a line break in the recipient",
      { ...message, to: "a@example.org\r\nRCPT TO:<b@example.org>" },
      "mail.header_injection",
    ],
    [
      "a recipient that would extend the command",
      { ...message, to: "a@example.org> NOTIFY=SUCCESS" },
      "mail.header_injection",
    ],
  ];

  for (const [name, invalid, code] of cases) {
    test(`${name}: ${code}`, async () => {
      const target = await stub();
      await expect(mailer(target, local).send(invalid)).rejects.toThrow(code);
      expect(target.dialled).toEqual([]);
      expect(target.connections).toBe(0);
    });
  }
});

describe("failures carry a named code", () => {
  test("a 550 to RCPT TO rejects without the words of the relay", async () => {
    const target = await stub({ rcptReply: "550 5.1.1 <a@example.org> user unknown\r\n" });
    const failure = await mailer(target, local)
      .send(message)
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    await target.settled();
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("mail.smtp_rejected");
    expect(String((failure as Error).stack)).not.toContain("user unknown");
    expect(target.commands).not.toContain("DATA");
    expect(target.contents).toEqual([]);
  });

  test("a 251 to RCPT TO is accepted", async () => {
    const target = await stub({ rcptReply: "251 user not local, will forward\r\n" });
    await mailer(target, local).send(message);
    await target.settled();
    expect(target.contents).toHaveLength(1);
  });

  test("a reply that is not SMTP rejects", async () => {
    const target = await stub({ ehloReply: "hello there\r\n" });
    await expect(mailer(target, local).send(message)).rejects.toThrow("mail.smtp_rejected");
    await target.settled();
    expect(target.commands).toEqual(["EHLO libre-ia.example"]);
  });

  test("a reply that never ends rejects", async () => {
    const target = await stub({ ehloReply: `250-${"x".repeat(70_000)}` });
    await expect(mailer(target, local).send(message)).rejects.toThrow("mail.smtp_rejected");
    await target.settled();
    expect(target.commands).toEqual(["EHLO libre-ia.example"]);
  });

  test("a relay that never greets rejects after the timeout", async () => {
    const target = await stub({ greeting: "silent" });
    // The deadline makes a transport that never gives up fail this test instead of hanging it.
    const deadline = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("test.deadline")), 1500).unref();
    });
    await expect(
      Promise.race([mailer(target, { timeoutMs: 50 }).send(message), deadline]),
    ).rejects.toThrow("mail.smtp_timeout");
    await target.settled();
    expect(target.connections).toBe(1);
    expect(target.rawFirstBytes).toEqual([]);
  });

  test("a relay that closes after its greeting rejects", async () => {
    const target = await stub({ greeting: "leave" });
    await expect(mailer(target, local).send(message)).rejects.toThrow(
      "mail.smtp_connection_failed",
    );
    await target.settled();
    expect(target.contents).toEqual([]);
  });
});

describe("structure", () => {
  const root = join(import.meta.dir, "..");

  test("the transport never turns certificate verification off and logs nothing", async () => {
    const source = await readFile(join(import.meta.dir, "smtp.ts"), "utf8");
    expect(source).not.toMatch(/rejectUnauthorized\s*:\s*false/);
    expect(source).toMatch(/rejectUnauthorized: true/);
    expect(source).not.toMatch(/\bconsole\b/);
    expect(source).not.toMatch(/from "\.\/log"|createLogger|\blog\.event\b/);
  });

  test("the package keeps no runtime dependency", async () => {
    const manifest: unknown = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(manifest).not.toHaveProperty("dependencies");
  });
});
