/**
 * SMTP transport of the waitlist messages (ADR 0006 §7), second implementation of `Mailer`.
 *
 * The channel is always encrypted: implicit TLS on port 465, STARTTLS required on any other port,
 * certificate always verified against the configured host. There is no fallback to clear text; the
 * only way out is `allowInsecureLocal`, accepted for a loopback relay alone. Written on node:net
 * and node:tls so the server keeps no runtime dependency.
 *
 * A failed send rejects with a named code and never with the relay's own words: a reply can quote
 * the recipient address, which must stay out of the logs (ADR 0006 §6). This file logs nothing.
 */
import { isIP, connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";

import { type Mailer, senderAddress } from "./mailer";
import { toRfc5322 } from "./messages";

export interface SmtpConfig {
  readonly host: string;
  /** 587 when absent. 465 means implicit TLS, any other port means STARTTLS. */
  readonly port?: number;
  readonly user?: string;
  readonly password?: string;
  /** Lets a loopback relay without STARTTLS be spoken to in clear. No effect on port 465. */
  readonly allowInsecureLocal?: boolean;
  /** Longest wait for one reply of the relay, 30000 when absent, an integer in 1..2^31-1. */
  readonly timeoutMs?: number;
  readonly clock?: () => Date;
}

/** Opens the TCP connection to the relay. Tests point it at a stub on the loopback interface. */
export type SmtpDial = (port: number, host: string) => Socket;

const DEFAULT_PORT = 587;
const IMPLICIT_TLS_PORT = 465;
const DEFAULT_TIMEOUT_MS = 30_000;
// setTimeout turns NaN, a negative delay or one above 2^31-1 into 1 ms.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
// Printable ASCII without brackets: an address outside it needs SMTPUTF8, never negotiated here.
const ENVELOPE_ADDRESS = /^[\x21-\x3b\x3d\x3f-\x7e]+$/;
const SINGLE_AT = /^[^@]+@[^@]+$/;
// A relay that never ends its reply must not fill the memory of the server.
const MAX_REPLY_LENGTH = 65_536;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1"]);

type FailureCode =
  | "mail.smtp_starttls_unavailable"
  | "mail.smtp_rejected"
  | "mail.smtp_connection_failed"
  | "mail.smtp_timeout";

interface Reply {
  readonly code: number;
  readonly lines: readonly string[];
}

interface Pending {
  /** True once the awaited event has happened and the waiter is resolved. */
  settle(): boolean;
  reject(error: Error): void;
}

/** One connection to the relay: reads replies, writes commands, and fails once, with one code. */
class Session {
  #socket: Socket;
  #buffer = "";
  #failure: Error | undefined;
  #pending: Pending | undefined;
  readonly #timeoutMs: number;

  constructor(socket: Socket, timeoutMs: number) {
    this.#socket = socket;
    this.#timeoutMs = timeoutMs;
    this.#listen(socket);
  }

  readonly #onData = (chunk: Buffer): void => {
    // The text of a reply is never used, so a byte-per-character decoding is enough and cannot
    // split a character across two chunks.
    this.#buffer += chunk.toString("latin1");
    if (this.#buffer.length > MAX_REPLY_LENGTH) this.fail("mail.smtp_rejected");
    else this.#advance();
  };

  readonly #onBroken = (): void => {
    this.fail("mail.smtp_connection_failed");
  };

  #listen(socket: Socket): void {
    socket.on("data", this.#onData);
    socket.on("error", this.#onBroken);
    socket.on("close", this.#onBroken);
  }

  /** Records the first failure, drops the connection, and returns the error to throw. */
  fail(code: FailureCode): Error {
    this.#failure ??= new Error(code);
    this.#socket.destroy();
    const pending = this.#pending;
    this.#pending = undefined;
    pending?.reject(this.#failure);
    return this.#failure;
  }

  #advance(): void {
    if (this.#pending?.settle() === true) this.#pending = undefined;
  }

  #wait<T>(poll: () => T | undefined): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // The connection can break between two steps: the recorded failure is then the answer.
      if (this.#failure !== undefined) {
        reject(this.#failure);
        return;
      }
      const timer = setTimeout(() => this.fail("mail.smtp_timeout"), this.#timeoutMs);
      this.#pending = {
        settle: () => {
          const value = poll();
          if (value === undefined) return false;
          clearTimeout(timer);
          resolve(value);
          return true;
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      this.#advance();
    });
  }

  /** The next complete reply in the buffer: `250-…` lines up to the closing `250 …` line. */
  #takeReply(): Reply | undefined {
    const lines: string[] = [];
    let offset = 0;
    for (;;) {
      const end = this.#buffer.indexOf("\n", offset);
      if (end === -1) return undefined;
      const match = /^(\d{3})(?:([ -])(.*))?$/.exec(
        this.#buffer.slice(offset, end).replace(/\r$/, ""),
      );
      offset = end + 1;
      if (match === null) {
        this.fail("mail.smtp_rejected");
        return undefined;
      }
      lines.push(match[3] ?? "");
      if (match[2] !== "-") {
        this.#buffer = this.#buffer.slice(offset);
        return { code: Number(match[1]), lines };
      }
    }
  }

  write(data: string): void {
    this.#socket.write(data, "utf8");
  }

  /** Sends a command when there is one, then requires one of the accepted reply codes. */
  async exchange(command: string | undefined, ...accepted: readonly number[]): Promise<Reply> {
    if (command !== undefined) this.write(`${command}\r\n`);
    const reply = await this.#wait(() => this.#takeReply());
    if (!accepted.includes(reply.code)) throw this.fail("mail.smtp_rejected");
    return reply;
  }

  /** Wraps the connection in TLS and waits for a handshake whose certificate matches the host. */
  async secure(host: string): Promise<void> {
    // Bytes that follow the go-ahead of the relay were written in clear, before the handshake:
    // reading them as the encrypted session's replies would let an injected answer through.
    if (this.#buffer !== "") throw this.fail("mail.smtp_rejected");
    const plain = this.#socket;
    plain.off("data", this.#onData);
    const secured = tlsConnect({
      socket: plain,
      host,
      // RFC 6066 forbids an address as server name; the certificate is still checked against it.
      ...(isIP(host) === 0 ? { servername: host } : {}),
      // Written out so that NODE_TLS_REJECT_UNAUTHORIZED cannot turn the verification off.
      rejectUnauthorized: true,
    });
    this.#socket = secured;
    this.#listen(secured);
    let established = false;
    secured.once("secureConnect", () => {
      established = true;
      this.#advance();
    });
    await this.#wait(() => (established ? true : undefined));
  }

  /** Says goodbye without waiting for the answer: the message is already accepted. */
  end(): void {
    this.#socket.off("close", this.#onBroken);
    this.#socket.end("QUIT\r\n", "utf8");
  }
}

function validated(config: SmtpConfig): {
  readonly host: string;
  readonly port: number;
  readonly credentials: string | undefined;
  readonly clearAllowed: boolean;
  readonly timeoutMs: number;
} {
  const host = config.host;
  if (typeof host !== "string" || host === "") throw new Error("mail.smtp_host_missing");
  const port = config.port ?? DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("mail.smtp_port_invalid");
  }
  if ((config.user === undefined) !== (config.password === undefined)) {
    throw new Error("mail.smtp_auth_incomplete");
  }
  const clearAllowed = config.allowInsecureLocal === true;
  if (clearAllowed && !LOOPBACK_HOSTS.has(host.toLowerCase())) {
    throw new Error("mail.smtp_insecure_not_local");
  }
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error("mail.smtp_timeout_invalid");
  }
  const credentials =
    config.user === undefined
      ? undefined
      : Buffer.from(`\0${config.user}\0${config.password}`, "utf8").toString("base64");
  return { host, port, credentials, clearAllowed, timeoutMs };
}

/** True for `local@domain` in printable ASCII, which needs no SMTPUTF8 in the envelope. */
function isEnvelopeAddress(address: string): boolean {
  return ENVELOPE_ADDRESS.test(address) && SINGLE_AT.test(address);
}

/** DATA content: no bare CR a relay could read as a line end, leading dots doubled, final CRLF. */
function dataContent(rfc5322: string): string {
  const lines = rfc5322.replace(/\r(?!\n)/g, "\r\n").replace(/(^|\r\n)\./g, "$1..");
  return `${lines.endsWith("\r\n") ? lines : `${lines}\r\n`}.\r\n`;
}

/**
 * A `Mailer` that hands each message to an SMTP relay. Throws a named code on an invalid
 * configuration; `send` resolves once the relay has accepted the message and rejects with a named
 * code otherwise.
 */
export function createSmtpMailer(config: SmtpConfig, dial: SmtpDial = netConnect): Mailer {
  const { host, port, credentials, clearAllowed, timeoutMs } = validated(config);
  const clock = config.clock ?? (() => new Date());
  const implicitTls = port === IMPLICIT_TLS_PORT;

  return {
    async send(message) {
      // Everything that can be refused without the relay is refused before a socket is opened.
      const sender = senderAddress(message.from);
      if (!isEnvelopeAddress(sender)) throw new Error("mail.sender_invalid");
      const domain = sender.slice(sender.lastIndexOf("@") + 1);
      const content = dataContent(
        toRfc5322(message, clock(), `<${crypto.randomUUID()}@${domain}>`),
      );
      // The recipient also goes into the envelope, where a bracket or a space would add a
      // parameter to the command.
      if (/[<>\s\p{Cc}]/u.test(message.to)) throw new Error("mail.header_injection");
      if (!isEnvelopeAddress(message.to)) throw new Error("mail.recipient_invalid");

      const session = new Session(dial(port, host), timeoutMs);
      if (implicitTls) await session.secure(host);
      await session.exchange(undefined, 220);
      const greeting = await session.exchange(`EHLO ${domain}`, 250);
      if (!implicitTls) {
        if (greeting.lines.some((line) => line.trim().toUpperCase() === "STARTTLS")) {
          await session.exchange("STARTTLS", 220);
          await session.secure(host);
          // What the relay announced in clear is forgotten; it speaks again once encrypted.
          await session.exchange(`EHLO ${domain}`, 250);
        } else if (!clearAllowed) {
          throw session.fail("mail.smtp_starttls_unavailable");
        }
      }
      // Reached only on an encrypted channel, or in clear on a loopback relay.
      if (credentials !== undefined) await session.exchange(`AUTH PLAIN ${credentials}`, 235);
      await session.exchange(`MAIL FROM:<${sender}>`, 250);
      await session.exchange(`RCPT TO:<${message.to}>`, 250, 251);
      await session.exchange("DATA", 354);
      session.write(content);
      await session.exchange(undefined, 250);
      session.end();
    },
  };
}
