/**
 * Parity test of the served runtime (ADR 0009, definition of ADR-0063 D5): the same requests
 * go to the Bun reference (`server/http.ts`), run twice, and to the Rust port (`site-server`),
 * each on its own fresh database. For every scenario of the corpus the test compares, after
 * every step, the response (status, headers, body) and the `subscribers` table, then the
 * messages written to the outbox and the log lines. What varies between the two runs of the
 * reference is covered by the named normalisers of `parity/normalize.ts`, nothing else.
 *
 * A scenario with an admitted divergence (`corpus.ts`) is held instead, on each side, to the
 * status, location, rows and messages its divergence states, under the Bun revision it names;
 * its headers, bodies and logs are not compared.
 *
 * Not compared: response time, memory, concurrency, the SMTP transport (both sides write to an
 * outbox; the Rust relay client has its own tests), store failures (Rust unit test
 * `a_store_failure_answers_500_without_detail_and_is_logged`), bodies over 64 KiB (each HTTP
 * stack refuses them its own way), what the Rust process logs up to `server.listening` (its
 * first purge) and its `server.stopped` line, which the reference has no counterpart for.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createServer } from "./http";
import { createLimiter } from "./limiter";
import { createLogger } from "./log";
import { createOutboxMailer, type Mailer } from "./mailer";
import { exchange } from "./parity/client";
import {
  CANONICAL_HOST,
  corpus,
  NOT_IN_CORPUS,
  ORIGIN,
  type Outcome,
  REDIRECT_HOSTS,
  type Scenario,
  SENDER,
  SOURCES,
  type Source,
  type Step,
  TEST_FILES,
  type TestRef,
} from "./parity/corpus";
import {
  type Applied,
  clockOrderViolations,
  type MessageTrace,
  messageTokens,
  NORMALISERS,
  noneApplied,
  normaliseRun,
  type RowTrace,
  type RunTrace,
  STEP_GAP_MS,
  type StepTrace,
} from "./parity/normalize";
import {
  currentRuntime,
  FINGERPRINT_PATH,
  type Fingerprint,
  fingerprint,
  REFERENCE_FILES,
  ROOT,
  renderFingerprint,
} from "./parity/reference";
import { purgeOnce } from "./purge";
import { purgeWithSiteServer, requireBinary, startSiteServer } from "./site-server-process";
import { createPgStore, migrate } from "./store";
import { startTestDatabase, type TestDatabase } from "./test-database";

// The limiter of the served runtime, the one the reference demo used: five per ten minutes.
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
const MESSAGE_WAIT_MS = 5000;
const LIFECYCLE_EVENTS = new Set(["server.listening", "server.stopped"]);

const SITE: Readonly<Record<string, string | Uint8Array>> = {
  "index.html": "<!doctype html><title>Accueil</title>",
  "404.html": "<!doctype html><title>Introuvable</title>",
  "assets/site.css": "body{}",
  "assets/app.js": "export {};",
  "assets/logo.svg": "<svg xmlns='http://www.w3.org/2000/svg'/>",
  "assets/font.woff2": Uint8Array.from([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0]),
  "sitemap.xml": "<?xml version='1.0'?><urlset/>",
  "robots.txt": "User-agent: *\n",
  "data.json": '{"a":1}',
  "misc.bin": Uint8Array.from([0, 255, 1]),
  "café.html": "<!doctype html><title>Café</title>",
  "a b.html": "<!doctype html><title>Espace</title>",
  ".hidden": "dot",
  "applications/index.html": "<!doctype html><title>Applications</title>",
  "inscription/merci/index.html": "<!doctype html><title>Merci</title>",
};

let workspace: string;
let siteDirectory: string;
let referenceDatabase: TestDatabase;
let portDatabase: TestDatabase;
let referenceSql: Bun.SQL;
let portSql: Bun.SQL;
let runs = 0;

const compared: Record<Source, number> = {
  "reference-tests": 0,
  "porting-risks": 0,
  authored: 0,
};
let stepsCompared = 0;
let admittedChecked = 0;
const applied: Applied = noneApplied();

const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const cssTag = `"${sha256("body{}")}"`;
const scenarios = corpus({ css: cssTag, cssGzip: `${cssTag.slice(0, -1)}-gzip"` });

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "parity-"));
  siteDirectory = join(workspace, "site");
  for (const [path, content] of Object.entries(SITE)) {
    await mkdir(dirname(join(siteDirectory, path)), { recursive: true });
    await writeFile(join(siteDirectory, path), content);
  }
  referenceDatabase = await startTestDatabase({ maxConnections: 4 });
  portDatabase = await startTestDatabase({ maxConnections: 4 });
  referenceSql = new Bun.SQL(referenceDatabase.url, { max: 1 });
  portSql = new Bun.SQL(portDatabase.url, { max: 1 });
  await migrate(referenceSql);
  // Two in-memory databases start here: the default 5 s bound fails on a loaded machine.
}, 30_000);

afterAll(async () => {
  await referenceSql?.close();
  await portSql?.close();
  await referenceDatabase?.stop();
  await portDatabase?.stop();
  await rm(workspace, { recursive: true, force: true });
});

function resolveTarget(target: string, messages: readonly MessageTrace[]): string {
  const tokens = messageTokens(messages);
  return target.replace(
    /\{(confirm|unsubscribe)(?::(\d+))?\}/g,
    (_match, kind: string, index?: string) => {
      const message = index === undefined ? tokens[tokens.length - 1] : tokens[Number(index)];
      const token = kind === "confirm" ? message?.confirm : message?.unsubscribe;
      // A placeholder without its message is a failure of the run, never an empty token.
      if (token === undefined || token === null) throw new Error(`parity.token_missing:${target}`);
      return token;
    },
  );
}

function requestBytes(step: Extract<Step, { kind: "http" }>, messages: readonly MessageTrace[]) {
  const body =
    step.body === undefined
      ? null
      : typeof step.body === "string"
        ? new TextEncoder().encode(step.body)
        : step.body;
  const lines = [`${step.method} ${resolveTarget(step.target, messages)} HTTP/1.1`];
  const host = step.host === undefined ? CANONICAL_HOST : step.host;
  if (host !== null) lines.push(`Host: ${host}`);
  for (const [name, value] of step.headers ?? []) lines.push(`${name}: ${value}`);
  if (body !== null) lines.push(`Content-Length: ${body.length}`);
  lines.push("Connection: close", "", "");
  const head = new TextEncoder().encode(lines.join("\r\n"));
  const out = new Uint8Array(head.length + (body?.length ?? 0));
  out.set(head, 0);
  if (body !== null) out.set(body, head.length);
  return out;
}

async function readOutbox(directory: string): Promise<MessageTrace[]> {
  const names = (await readdir(directory).catch(() => [] as string[])).sort();
  return Promise.all(
    names.map(async (file) => ({ file, raw: await readFile(join(directory, file), "utf8") })),
  );
}

async function rows(sql: Bun.SQL): Promise<RowTrace[]> {
  return (await sql`
    select email, state, universes, follow, tester, consent_version, requested_at, confirmed_at,
      confirm_hash, unsubscribe_hash
    from subscribers order by email
  `) as RowTrace[];
}

const age = (sql: Bun.SQL, hours: number) =>
  sql`update subscribers set requested_at = requested_at - (${hours} * interval '1 hour')`;

/** The start of a step, `STEP_GAP_MS` at least after the previous one ended (`row-clock`). */
async function stepStart(steps: readonly StepTrace[]): Promise<number> {
  const previous = steps.at(-1);
  while (previous !== undefined && Date.now() < previous.ended + STEP_GAP_MS) await Bun.sleep(1);
  return Date.now();
}

const label = (step: Step) =>
  step.kind === "http"
    ? `${step.method} ${step.target}`
    : `${step.kind}${"hours" in step ? ` ${step.hours}` : ""}`;

async function runReference(scenario: Scenario): Promise<RunTrace> {
  runs += 1;
  await referenceSql`delete from subscribers`;
  const outbox = join(workspace, `outbox-${runs}`);
  const logs: string[] = [];
  const purgeLogs: string[] = [];
  const sending: Promise<unknown>[] = [];
  const outboxMailer = createOutboxMailer(outbox);
  const mailer: Mailer = {
    send(message) {
      const sent = outboxMailer.send(message);
      sending.push(sent.catch(() => undefined));
      return sent;
    },
  };
  const store = createPgStore(referenceSql);
  const server = await createServer({
    siteDirectory,
    origin: ORIGIN,
    redirectHosts: REDIRECT_HOSTS,
    store,
    mailer,
    from: SENDER,
    limiter: createLimiter({ limit: LIMIT, windowMs: WINDOW_MS }),
    logger: createLogger((line) => logs.push(line)),
    port: 0,
    hostname: "127.0.0.1",
  });
  const steps: StepTrace[] = [];
  let agedHours = 0;
  try {
    for (const step of scenario.steps) {
      const started = await stepStart(steps);
      let response = null;
      if (step.kind === "http") {
        response = await exchange(
          server.port ?? 0,
          step.method,
          requestBytes(step, await readOutbox(outbox)),
        );
        await Promise.all(sending);
      } else if (step.kind === "age") {
        await age(referenceSql, step.hours);
        agedHours += step.hours;
      } else {
        await purgeOnce(
          store,
          createLogger((line) => purgeLogs.push(line)),
          new Date(),
        );
      }
      steps.push({
        label: label(step),
        response,
        rows: await rows(referenceSql),
        messageCount: (await readOutbox(outbox)).length,
        started,
        ended: Date.now(),
        agedHours,
      });
    }
  } finally {
    server.stop(true);
  }
  return { steps, messages: await readOutbox(outbox), logs, purgeLogs };
}

/** Waits until the outbox holds `expected` messages, within a bound; the port sends after answering. */
async function outboxReaching(directory: string, expected: number): Promise<MessageTrace[]> {
  const deadline = Date.now() + MESSAGE_WAIT_MS;
  let messages = await readOutbox(directory);
  while (messages.length < expected && Date.now() < deadline) {
    await Bun.sleep(10);
    messages = await readOutbox(directory);
  }
  return messages;
}

/** `expectedMessages[i]`: the messages to wait for after step i, since the port sends after answering. */
async function runPort(scenario: Scenario, expectedMessages: readonly number[]): Promise<RunTrace> {
  let agedHours = 0;
  runs += 1;
  const outbox = join(workspace, `outbox-${runs}`);
  const purgeLogs: string[] = [];
  // The port creates its table at start (its own migration): the table is emptied after it.
  const server = await startSiteServer({
    SITE_DIRECTORY: siteDirectory,
    SITE_ORIGIN: ORIGIN,
    SITE_REDIRECT_HOSTS: REDIRECT_HOSTS.join(","),
    SITE_LISTEN: "127.0.0.1:0",
    POSTGRESQL_ADDON_URI: portDatabase.url,
    POSTGRESQL_ALLOW_INSECURE_LOCAL: "1",
    POSTGRESQL_MAX_CONNECTIONS: "1",
    WAITLIST_FROM: SENDER,
    WAITLIST_OUTBOX: outbox,
  });
  const steps: StepTrace[] = [];
  let code: number | null = null;
  try {
    await portSql`delete from subscribers`;
    for (const [index, step] of scenario.steps.entries()) {
      const started = await stepStart(steps);
      let response = null;
      if (step.kind === "http") {
        response = await exchange(
          server.port,
          step.method,
          requestBytes(step, await readOutbox(outbox)),
        );
      } else if (step.kind === "age") {
        await age(portSql, step.hours);
        agedHours += step.hours;
      } else {
        const purge = await purgeWithSiteServer(portDatabase.url);
        if (purge.code !== 0) throw new Error(`parity.purge_failed:${purge.lines.join(" | ")}`);
        purgeLogs.push(...purge.lines);
      }
      const expected = expectedMessages[index] ?? 0;
      steps.push({
        label: label(step),
        response,
        rows: await rows(portSql),
        messageCount: (await outboxReaching(outbox, expected)).length,
        started,
        ended: Date.now(),
        agedHours,
      });
    }
  } finally {
    code = await server.stop();
  }
  if (code !== 0) throw new Error(`parity.port_exit:${code}:${server.lines.join(" | ")}`);
  // What the port logs before it listens (its first purge) has no counterpart in the reference.
  const listening = server.lines.findIndex((line) => JSON.parse(line).event === "server.listening");
  if (listening === -1) throw new Error(`parity.port_never_listened:${server.lines.join(" | ")}`);
  const logs = server.lines
    .slice(listening + 1)
    .filter((line) => !LIFECYCLE_EVENTS.has(JSON.parse(line).event));
  return { steps, messages: await readOutbox(outbox), logs, purgeLogs };
}

const testKey = ({ file, test }: TestRef) => `${file} › ${test}`;

/** The test names of each file of `TEST_FILES`; a test declared in another form fails. */
async function referenceTests(): Promise<string[]> {
  const keys: string[] = [];
  for (const file of TEST_FILES) {
    const text = await readFile(join(ROOT, file), "utf8");
    const names = [...text.matchAll(/\btest\(\s*"((?:[^"\\]|\\.)*)"/g)].map(
      (match) => JSON.parse(`"${match[1]}"`) as string,
    );
    // Every `test(` must have been read as a name, and no `test.each`/`test.skip` may hide one.
    expect([file, names.length]).toEqual([file, text.match(/\btest\(/g)?.length ?? 0]);
    expect([file, text.match(/\btest\.\w+\(/g) ?? []]).toEqual([file, []]);
    keys.push(...names.map((test) => testKey({ file, test })));
  }
  return keys;
}

const runTokens = (run: RunTrace) =>
  messageTokens(run.messages).flatMap(({ confirm, unsubscribe }) =>
    [confirm, unsubscribe].filter((token): token is string => token !== null),
  );

/**
 * The `token` normaliser takes any 43 base64url characters. What it cannot see is held here: each
 * token of the port carries 32 bytes, none repeats within the run, none was seen in a reference
 * run. That rules out a constant or replayed token, not a predictable one: unpredictability is
 * held by `tokens.rs` (the operating system's generator), which no comparison can show.
 */
function tokenFaults(port: RunTrace, references: readonly RunTrace[]): string[] {
  const tokens = runTokens(port);
  const seen = new Set(references.flatMap(runTokens));
  return [
    ...tokens
      .filter((token) => Buffer.from(token, "base64url").length !== 32)
      .map(() => "a token not of 32 bytes"),
    ...(new Set(tokens).size === tokens.length ? [] : ["a token repeated within the run"]),
    ...tokens.filter((token) => seen.has(token)).map(() => "a token seen in a reference run"),
  ];
}

/** What each step of a run answered, for an admitted divergence: HTTP steps only. */
function outcomes(run: RunTrace): Outcome[] {
  return run.steps.flatMap(({ response, rows, messageCount }) => {
    if (response === null) return [];
    const location = response.headers.find(([name]) => name === "location")?.[1];
    return [
      {
        status: response.status,
        ...(location === undefined ? {} : { location }),
        rows: rows.length,
        messages: messageCount,
      },
    ];
  });
}

describe("parity of the Rust port with the Bun reference (ADR 0009)", () => {
  test("the reference is the recorded one, under the recorded Bun, and every source is present", async () => {
    const recorded = await readFile(join(ROOT, FINGERPRINT_PATH), "utf8");
    // The runtime first, for a readable failure: the reference's answers depend on it.
    expect(currentRuntime()).toEqual((JSON.parse(recorded) as Fingerprint).runtime);
    // Byte for byte: a digest that changes, appears or disappears fails until it is re-recorded.
    expect(renderFingerprint(await fingerprint())).toBe(recorded);
    requireBinary();
    const sources = new Set(scenarios.map((scenario) => scenario.source));
    expect([...SOURCES].filter((source) => !sources.has(source))).toEqual([]);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);
  });

  test("each source holds what it claims: reference tests replayed, constructions present", async () => {
    const known = await referenceTests();
    const covered = new Set(scenarios.flatMap((scenario) => (scenario.covers ?? []).map(testKey)));
    const excused = new Set(NOT_IN_CORPUS.map(testKey));
    const exists = new Set(known);
    // A cited test that does not exist, an uncited test, a test both replayed and excused: all fail.
    expect([...covered, ...excused].filter((key) => !exists.has(key))).toEqual([]);
    expect(known.filter((key) => !covered.has(key) && !excused.has(key))).toEqual([]);
    expect([...covered].filter((key) => excused.has(key))).toEqual([]);
    const reference = (
      await Promise.all(REFERENCE_FILES.map((path) => readFile(join(ROOT, path), "utf8")))
    ).join("\n");
    const constructs = scenarios.flatMap((scenario) => scenario.constructs ?? []);
    expect(constructs.filter((construct) => !reference.includes(construct))).toEqual([]);
    for (const scenario of scenarios) {
      const claims = {
        id: scenario.id,
        covers: (scenario.covers?.length ?? 0) > 0,
        constructs: (scenario.constructs?.length ?? 0) > 0,
      };
      expect(claims).toEqual({
        id: scenario.id,
        covers: scenario.source === "reference-tests",
        constructs: scenario.source === "porting-risks",
      });
      const admitted = scenario.admitted;
      if (admitted !== undefined) {
        // An admitted divergence states every step on both sides; HTTP steps only.
        expect(scenario.steps.every((step) => step.kind === "http")).toBe(true);
        expect([admitted.reference.length, admitted.port.length]).toEqual([
          scenario.steps.length,
          scenario.steps.length,
        ]);
      }
    }
    console.log(
      `Parity corpus: ${known.length} reference test(s) in ${TEST_FILES.length} file(s), ${covered.size} replayed, ` +
        `${excused.size} excused; ${new Set(constructs).size} construction(s) found in ${REFERENCE_FILES.length} reference file(s).`,
    );
    expect(covered.size + excused.size).toBe(known.length);
  });

  test.each(scenarios.map((scenario) => [scenario.id, scenario] as const))(
    "%s",
    async (_id, scenario) => {
      const first = await runReference(scenario);
      const second = await runReference(scenario);
      const reference = normaliseRun(first, applied);
      // D5 (b): the declared normalisers cover everything that varies between two reference runs.
      expect(normaliseRun(second, noneApplied())).toEqual(reference);
      expect([...clockOrderViolations(first), ...clockOrderViolations(second)]).toEqual([]);
      const admitted = scenario.admitted;
      if (admitted === undefined) {
        const port = await runPort(
          scenario,
          first.steps.map((step) => step.messageCount),
        );
        expect(clockOrderViolations(port)).toEqual([]);
        expect(tokenFaults(port, [first, second])).toEqual([]);
        expect(normaliseRun(port, applied)).toEqual(reference);
      } else {
        // The divergence was measured against one Bun: under another, it is measured again.
        expect(currentRuntime().revision).toBe(admitted.runtime);
        expect(outcomes(first)).toEqual([...admitted.reference]);
        const port = await runPort(
          scenario,
          admitted.port.map((outcome) => outcome.messages),
        );
        expect(clockOrderViolations(port)).toEqual([]);
        expect(outcomes(port)).toEqual([...admitted.port]);
        // Read after the stop, which drains the sends: a late message is still counted.
        expect(port.messages.length).toBe(admitted.port.at(-1)?.messages ?? 0);
        admittedChecked += 1;
      }
      compared[scenario.source] += 1;
      stepsCompared += scenario.steps.length;
    },
    30_000,
  );

  test("the two databases hold the same table definition", async () => {
    const catalogue = (sql: Bun.SQL) => sql`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_name = 'subscribers' order by column_name
    `;
    const constraints = (sql: Bun.SQL) => sql`
      select pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid = 'subscribers'::regclass order by 1
    `;
    expect(await catalogue(portSql)).toEqual(await catalogue(referenceSql));
    expect(await constraints(portSql)).toEqual(await constraints(referenceSql));
    expect((await catalogue(portSql)).length).toBe(10);
  });

  test("prints the volume compared and refuses an empty comparison", () => {
    const total = Object.values(compared).reduce((sum, count) => sum + count, 0);
    console.log(
      `Parity: ${total} scenario(s) compared (${SOURCES.map((source) => `${source} ${compared[source]}`).join(", ")}), ` +
        `${admittedChecked} of them held to an admitted divergence, ` +
        `${stepsCompared} step(s), normalisers applied: ${NORMALISERS.map((name) => `${name} ${applied[name]}`).join(", ")}.`,
    );
    expect(total).toBe(scenarios.length);
    expect(admittedChecked).toBe(scenarios.filter((scenario) => scenario.admitted).length);
    for (const source of SOURCES) expect(compared[source]).toBeGreaterThan(0);
  });
});
