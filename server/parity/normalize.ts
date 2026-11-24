/**
 * Normalisers of the parity test (ADR 0009, ADR-0063 D5 (b)). Each one is named, covers only
 * the field it names, and checks the shape of the value it replaces: a value of another shape
 * is left as it is, so it still differs and the test fails. There is no wildcard.
 *
 * What varies between two runs of the reference on the same input, and why:
 * - `gzip-body`: a compressed body; the bytes depend on the compressor (zlib in Bun, miniz in
 *   Rust), the content does not — compared after decompression;
 * - `token`: the 43-character base64url tokens written into each message (32 random bytes);
 * - `token-digest`: `confirm_hash` and `unsubscribe_hash`, replaced by the token whose SHA-256
 *   they are — a digest that matches no token of the run stays as it is;
 * - `row-clock`: `requested_at` and `confirmed_at`, replaced by the step of the run whose test
 *   clock window holds them (from the step's start to its end, `CLOCK_SLACK_MS` after) —
 *   `requested_at` once the ageing done since that step is undone,
 *   `confirmed_at` as it is, since ageing never moves it. A renewal that keeps the first
 *   request's time, or a date away from the test clock, names another step or none, and a value
 *   that falls in no window stays as it is, so the comparison fails. `clockOrderViolations`
 *   holds the last relation: a row is never confirmed before it was requested;
 * - `message-date`: the `Date` header of a message, in the RFC 5322 form;
 * - `message-id`: the random UUID of `Message-ID`, the domain kept;
 * - `outbox-file-stamp`: the ISO 8601 stamp of an outbox file name, the order number kept.
 *
 * Not compared at all (transport, set by each HTTP stack): the `date`, `content-length`,
 * `connection`, `keep-alive` and `transfer-encoding` response headers.
 */
import { gunzipSync } from "node:zlib";

import { hashToken } from "../tokens";

export const NORMALISERS = [
  "gzip-body",
  "token",
  "token-digest",
  "row-clock",
  "message-date",
  "message-id",
  "outbox-file-stamp",
] as const;
export type Normaliser = (typeof NORMALISERS)[number];

export const TRANSPORT_HEADERS: ReadonlySet<string> = new Set([
  "date",
  "content-length",
  "connection",
  "keep-alive",
  "transfer-encoding",
]);

export interface ResponseTrace {
  readonly status: number;
  readonly headers: readonly (readonly [string, string])[];
  readonly body: Uint8Array;
}

export interface RowTrace {
  readonly [column: string]: unknown;
}

export interface StepTrace {
  readonly label: string;
  readonly response: ResponseTrace | null;
  readonly rows: readonly RowTrace[];
  readonly messageCount: number;
  /** Test clock, in milliseconds, when the step began and once its trace was read. */
  readonly started: number;
  readonly ended: number;
  /** Seconds every `requested_at` was moved back since the start of the run, this step included. */
  readonly agedSeconds: number;
}

export interface MessageTrace {
  readonly file: string;
  readonly raw: string;
}

export interface RunTrace {
  readonly steps: readonly StepTrace[];
  readonly messages: readonly MessageTrace[];
  /** Log lines of the server, in order. */
  readonly logs: readonly string[];
  /** Log lines of the purges, in order: a purge runs beside the server, so the two are kept apart. */
  readonly purgeLogs: readonly string[];
}

/** How many values each normaliser replaced, for the volume the test prints. */
export type Applied = Record<Normaliser, number>;

export const noneApplied = (): Applied =>
  Object.fromEntries(NORMALISERS.map((name) => [name, 0])) as Applied;

const TOKEN = /[A-Za-z0-9_-]{43}/;
const LINK = (path: string) => new RegExp(`/${path}\\?jeton=(${TOKEN.source})(?![A-Za-z0-9_-])`);
// Typed `RegExp` so the fleet SQL-construction gate (project-governance
// ecosystem/sql-construction-scanner.ts) can tell their `.exec` from a database's.
const CONFIRM_LINK: RegExp = LINK("confirmer");
const UNSUBSCRIBE_LINK: RegExp = LINK("desinscrire");
const RFC5322_DATE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} \+0000$/;
const MESSAGE_ID =
  /^<[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@([^>]+)>$/;
const OUTBOX_FILE = /^(\d{4})-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.eml$/;

/** The tokens of each message, by order, read from its links. */
export function messageTokens(
  messages: readonly MessageTrace[],
): { readonly confirm: string | null; readonly unsubscribe: string | null }[] {
  return messages.map(({ raw }) => ({
    confirm: CONFIRM_LINK.exec(raw)?.[1] ?? null,
    unsubscribe: UNSUBSCRIBE_LINK.exec(raw)?.[1] ?? null,
  }));
}

interface Replacement {
  readonly value: string;
  readonly label: string;
}

function replacements(messages: readonly MessageTrace[]): {
  tokens: Replacement[];
  digests: Map<string, string>;
} {
  const tokens: Replacement[] = [];
  const digests = new Map<string, string>();
  messageTokens(messages).forEach(({ confirm, unsubscribe }, index) => {
    for (const [kind, token] of [
      ["confirm", confirm],
      ["unsubscribe", unsubscribe],
    ] as const) {
      if (token === null) continue;
      tokens.push({ value: token, label: `<${kind} token of message ${index}>` });
      digests.set(hashToken(token), `<digest of the ${kind} token of message ${index}>`);
    }
  });
  return { tokens, digests };
}

function replaceTokens(text: string, tokens: readonly Replacement[], applied: Applied): string {
  let out = text;
  for (const { value, label } of tokens) {
    const parts = out.split(value);
    applied.token += parts.length - 1;
    out = parts.join(label);
  }
  return out;
}

function bodyText(body: Uint8Array): string {
  const decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  try {
    return decoded.decode(body);
  } catch {
    return `base64:${Buffer.from(body).toString("base64")}`;
  }
}

function normaliseResponse(
  response: ResponseTrace,
  tokens: readonly Replacement[],
  applied: Applied,
): unknown {
  const headers = response.headers
    .filter(([name]) => !TRANSPORT_HEADERS.has(name))
    .map(([name, value]) => `${name}: ${value}`)
    .sort();
  const gzip = response.headers.some(
    ([name, value]) => name === "content-encoding" && value === "gzip",
  );
  let body = response.body;
  if (gzip && body.length > 0) {
    body = new Uint8Array(gunzipSync(body));
    applied["gzip-body"] += 1;
  }
  return { status: response.status, headers, body: replaceTokens(bodyText(body), tokens, applied) };
}

const SECOND_MS = 1000;

/**
 * Milliseconds a stored time may read past the end of its step: the port writes microseconds,
 * which the database driver may round up to the next millisecond. The runners start each step
 * at least `STEP_GAP_MS` after the previous one ended, so the windows never touch.
 */
export const CLOCK_SLACK_MS = 1;
export const STEP_GAP_MS = CLOCK_SLACK_MS + 1;

/**
 * The step whose window holds `value`, read in the rows of step `at`: step k owns
 * [its start, its end + `CLOCK_SLACK_MS`]. Windows that touch are a failure of the run.
 */
export function clockStep(
  value: Date,
  column: "requested_at" | "confirmed_at",
  at: number,
  steps: readonly StepTrace[],
): number | null {
  const reading = steps[at];
  if (reading === undefined) return null;
  for (let k = at; k >= 0; k -= 1) {
    const step = steps[k];
    if (step === undefined) return null;
    const previous = steps[k - 1];
    if (previous !== undefined && step.started <= previous.ended + CLOCK_SLACK_MS) {
      throw new Error(`parity.clock_windows_touch:${k}`);
    }
    // Ageing moves `requested_at` back; undone here, what remains is the time it was written.
    const shift =
      column === "requested_at" ? (reading.agedSeconds - step.agedSeconds) * SECOND_MS : 0;
    const time = value.getTime() + shift;
    if (time >= step.started && time <= step.ended + CLOCK_SLACK_MS) return k;
  }
  return null;
}

/** Rows confirmed before they were requested, by step; empty when the relation holds. */
export function clockOrderViolations(run: RunTrace): string[] {
  return run.steps.flatMap((step, index) =>
    step.rows
      .filter(
        ({ requested_at, confirmed_at }) =>
          requested_at instanceof Date &&
          confirmed_at instanceof Date &&
          confirmed_at.getTime() < requested_at.getTime(),
      )
      .map(() => `step ${index} (${step.label}): confirmed_at before requested_at`),
  );
}

function normaliseRow(
  row: RowTrace,
  at: number,
  steps: readonly StepTrace[],
  digests: Map<string, string>,
  applied: Applied,
): unknown {
  const out: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    const step =
      (column === "requested_at" || column === "confirmed_at") && value instanceof Date
        ? clockStep(value, column, at, steps)
        : null;
    if (step !== null) {
      applied["row-clock"] += 1;
      out[column] = `<clock of step ${step}>`;
    } else if (
      (column === "confirm_hash" || column === "unsubscribe_hash") &&
      typeof value === "string" &&
      digests.has(value)
    ) {
      applied["token-digest"] += 1;
      out[column] = digests.get(value);
    } else {
      out[column] = value;
    }
  }
  return out;
}

function normaliseMessage(
  message: MessageTrace,
  tokens: readonly Replacement[],
  applied: Applied,
): unknown {
  const file = OUTBOX_FILE.exec(message.file);
  let name = message.file;
  if (file !== null) {
    applied["outbox-file-stamp"] += 1;
    name = `${file[1]}-<stamp>.eml`;
  }
  const raw = message.raw
    .split("\r\n")
    .map((line) => {
      if (line.startsWith("Date: ") && RFC5322_DATE.test(line.slice(6))) {
        applied["message-date"] += 1;
        return "Date: <date>";
      }
      const id = line.startsWith("Message-ID: ") ? MESSAGE_ID.exec(line.slice(12)) : null;
      if (id !== null) {
        applied["message-id"] += 1;
        return `Message-ID: <<uuid>@${id[1]}>`;
      }
      return line;
    })
    .join("\r\n");
  return { file: name, raw: replaceTokens(raw, tokens, applied) };
}

/** The run with every declared variation replaced; what two runs must share to agree. */
export function normaliseRun(run: RunTrace, applied: Applied): unknown {
  const { tokens, digests } = replacements(run.messages);
  return {
    steps: run.steps.map((step, at) => ({
      label: step.label,
      response: step.response === null ? null : normaliseResponse(step.response, tokens, applied),
      rows: step.rows.map((row) => normaliseRow(row, at, run.steps, digests, applied)),
      messageCount: step.messageCount,
    })),
    messages: run.messages.map((message) => normaliseMessage(message, tokens, applied)),
    logs: run.logs,
    purgeLogs: run.purgeLogs,
  };
}
