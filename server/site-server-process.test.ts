import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  listeningPort,
  requireBinary,
  SITE_SERVER_BINARY,
  startSiteServer,
} from "./site-server-process";
import { startTestDatabase, type TestDatabase } from "./test-database";

// A database and a child process start here: the default 5 s bound fails on a loaded machine.
const PROCESS_BOUND_MS = 30_000;

let workspace: string;
let database: TestDatabase;

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "site-server-"));
  await mkdir(join(workspace, "site"), { recursive: true });
  await writeFile(join(workspace, "site", "index.html"), "<!doctype html><title>Libre IA</title>");
  database = await startTestDatabase({ maxConnections: 4 });
}, PROCESS_BOUND_MS);

afterAll(async () => {
  await database?.stop();
  await rm(workspace, { recursive: true, force: true });
});

const serving = (extra: Readonly<Record<string, string>> = {}) => ({
  SITE_DIRECTORY: join(workspace, "site"),
  SITE_ORIGIN: "http://localhost",
  SITE_LISTEN: "127.0.0.1:0",
  POSTGRESQL_ADDON_URI: database.url,
  POSTGRESQL_ALLOW_INSECURE_LOCAL: "1",
  WAITLIST_FROM: "Libre IA <liste@libre-ia.example>",
  WAITLIST_OUTBOX: join(workspace, "outbox"),
  ...extra,
});

const events = (lines: readonly string[]) =>
  lines.map((line) => (JSON.parse(line) as { event: string }).event);

describe("site-server child process", () => {
  test("reads the port of the start line only", () => {
    expect(listeningPort('{"event":"server.listening","port":8080}')).toBe(8080);
    expect(listeningPort('{"event":"server.stopped"}')).toBeNull();
    expect(listeningPort('{"event":"server.listening","port":"8080"}')).toBeNull();
    expect(listeningPort("not json")).toBeNull();
  });

  test("an absent binary fails, it is never replaced", () => {
    expect(() => requireBinary("/nonexistent/site-server")).toThrow("site_server.binary_missing");
  });

  test("a binary older than its sources is refused, a newer one is run", async () => {
    const sources = join(workspace, "sources");
    await mkdir(join(sources, "src"), { recursive: true });
    await writeFile(join(sources, "src", "main.rs"), "fn main() {}");
    const binary = join(workspace, "site-server-copy");
    await writeFile(binary, "");
    const past = new Date(Date.now() - 3_600_000);
    await utimes(binary, past, past);
    expect(() => requireBinary(binary, sources)).toThrow("site_server.binary_stale");
    const future = new Date(Date.now() + 3_600_000);
    await utimes(binary, future, future);
    expect(requireBinary(binary, sources)).toBe(binary);
    // The real binary was just built from the real sources (`bun run test` builds first).
    expect(requireBinary()).toBe(SITE_SERVER_BINARY);
  });

  test(
    "a binary that exits before listening fails the start with its log lines",
    async () => {
      // No configuration at all: the binary refuses to start and names the missing variable.
      await expect(startSiteServer({})).rejects.toThrow("server.start_failed");
    },
    PROCESS_BOUND_MS,
  );

  test(
    "refuses a database channel that is not verified TLS, before connecting",
    async () => {
      const withoutException = serving();
      delete (withoutException as Record<string, string>).POSTGRESQL_ALLOW_INSECURE_LOCAL;
      await expect(startSiteServer(withoutException)).rejects.toThrow(
        '"reason":"database.tls_unverified"',
      );
      await expect(
        startSiteServer(
          serving({ POSTGRESQL_ADDON_URI: "postgres://site@db.example/waitlist?sslmode=require" }),
        ),
      ).rejects.toThrow('"reason":"database.insecure_not_local"');
    },
    PROCESS_BOUND_MS,
  );

  test(
    "purges expired requests at start, before it listens",
    async () => {
      const server = await startSiteServer(serving());
      const code = await server.stop();
      expect(code).toBe(0);
      const started = events(server.lines);
      expect(started.slice(0, 2)).toEqual(["subscription.purge", "server.listening"]);
    },
    PROCESS_BOUND_MS,
  );

  test(
    "a stop ends within its bound while a client never finishes its request",
    async () => {
      const server = await startSiteServer(serving());
      const client = connect(server.port, "127.0.0.1");
      await new Promise<void>((resolve) => client.once("connect", () => resolve()));
      client.write("GET / HTTP/1.1\r\nHost: localhost\r\n");
      client.on("error", () => {});
      await Bun.sleep(200);
      const started = Date.now();
      const code = await server.stop();
      const elapsed = Date.now() - started;
      client.destroy();
      expect(code).toBe(0);
      // Connections get 10 s, then the sends their own drain: never the client's will.
      expect(elapsed).toBeLessThan(20_000);
      expect(events(server.lines)).toContain("server.stopped");
    },
    PROCESS_BOUND_MS,
  );
});
