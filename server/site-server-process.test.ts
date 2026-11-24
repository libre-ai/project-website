import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  binaryFreshIn,
  cargoSaysFresh,
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
    const neverAsked = () => {
      throw new Error("cargo asked with no manifest newer than the binary");
    };
    expect(() => requireBinary(binary, sources, [], neverAsked)).toThrow(
      "site_server.binary_stale",
    );
    const future = new Date(Date.now() + 3_600_000);
    await utimes(binary, future, future);
    expect(requireBinary(binary, sources, [], neverAsked)).toBe(binary);
    // The real binary was just built from the real sources (`bun run test` builds first).
    expect(requireBinary()).toBe(SITE_SERVER_BINARY);
  });

  test("a manifest newer than the binary makes it stale unless cargo finds it fresh", async () => {
    const sources = join(workspace, "manifest-sources");
    await mkdir(join(sources, "src"), { recursive: true });
    await writeFile(join(sources, "src", "main.rs"), "fn main() {}");
    const manifest = join(sources, "Cargo.toml");
    await writeFile(manifest, "[package]");
    const lock = join(workspace, "Cargo.lock");
    await writeFile(lock, "version = 4");
    const binary = join(workspace, "site-server-manifest-copy");
    await writeFile(binary, "");
    const older = new Date(Date.now() - 7_200_000);
    const now = new Date();
    const newer = new Date(Date.now() + 3_600_000);
    for (const path of [join(sources, "src", "main.rs"), manifest, lock]) {
      await utimes(path, older, older);
    }
    await utimes(binary, now, now);
    let asked = 0;
    const cargo = (fresh: boolean) => () => {
      asked += 1;
      return fresh;
    };
    expect(requireBinary(binary, sources, [manifest, lock], cargo(false))).toBe(binary);
    expect(asked).toBe(0);
    // The crate's own manifest, then the workspace lock file, rewritten after the build.
    for (const changed of [manifest, lock]) {
      await utimes(changed, newer, newer);
      expect(() => requireBinary(binary, sources, [manifest, lock], cargo(false))).toThrow(
        "site_server.binary_stale",
      );
      expect(requireBinary(binary, sources, [manifest, lock], cargo(true))).toBe(binary);
      await utimes(changed, older, older);
    }
    expect(asked).toBe(4);
    // A declared manifest that is absent fails, it is never read as old.
    expect(() =>
      requireBinary(binary, sources, [manifest, join(workspace, "absent.lock")], cargo(true)),
    ).toThrow("site_server.sources_missing");
  });

  test("reads cargo's verdict on the site-server binary only", () => {
    const artifact = (name: string, fresh: boolean) =>
      JSON.stringify({ reason: "compiler-artifact", target: { name }, fresh });
    const built = '{"reason":"build-finished","success":true}';
    expect(
      binaryFreshIn([artifact("serde", false), artifact("site-server", true), built].join("\n")),
    ).toBe(true);
    expect(
      binaryFreshIn([artifact("serde", true), artifact("site-server", false), built].join("\n")),
    ).toBe(false);
    // No message about the binary: never read as fresh.
    expect(binaryFreshIn([artifact("serde", true), built].join("\n"))).toBe(false);
  });

  test(
    "cargo finds the binary just built fresh",
    () => {
      // `bun run test` built it; the real verdict, read from cargo's own messages.
      expect(cargoSaysFresh()).toBe(true);
    },
    PROCESS_BOUND_MS,
  );

  test(
    "an offline build without the crates in the cargo cache names how to get them",
    async () => {
      const emptyCache = join(workspace, "empty-cargo-home");
      await mkdir(emptyCache, { recursive: true });
      expect(() => cargoSaysFresh({ ...process.env, CARGO_HOME: emptyCache })).toThrow(
        "run `cargo fetch --locked` first, or point CARGO_HOME at a cache that holds them",
      );
    },
    PROCESS_BOUND_MS,
  );

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

  test(
    "a stop abandons, within its bound, an answer that a slow reader keeps alive",
    async () => {
      // A large answer read a little at a time: each write makes progress, so no time bound of
      // the connection ends it, and only the stop bound can (`server.connections_abandoned`).
      const site = join(workspace, "large-site");
      await mkdir(site, { recursive: true });
      await writeFile(join(site, "index.html"), "<!doctype html><title>Libre IA</title>");
      // `.woff2` is served as it is, without a gzip copy to build at start.
      const size = 32 * 1024 * 1024;
      await writeFile(join(site, "large.woff2"), randomBytes(size));
      // The debug binary reads and digests 32 MiB before it listens: on a loaded machine that
      // passed the 15 s default (a local run at load average 30), so the start gets 45 s.
      const server = await startSiteServer(serving({ SITE_DIRECTORY: site }), {
        startTimeoutMs: 45_000,
      });
      const client = connect(server.port, "127.0.0.1");
      client.on("error", () => {});
      await new Promise<void>((resolve) => client.once("connect", () => resolve()));
      let received = 0;
      client.pause();
      const reading = setInterval(() => {
        client.once("data", (chunk: Buffer) => {
          received += chunk.length;
          client.pause();
        });
        client.resume();
        // One chunk a second, far inside the 10 s idle bound; a chunk may reach half a megabyte.
      }, 1_000);
      client.write("GET /large.woff2 HTTP/1.1\r\nHost: localhost\r\n\r\n");
      await Bun.sleep(1_000);
      const started = Date.now();
      const code = await server.stop();
      const elapsed = Date.now() - started;
      clearInterval(reading);
      client.destroy();
      expect(code).toBe(0);
      // The answer was under way, and still unfinished when the process stopped.
      expect(received).toBeGreaterThan(0);
      expect(received).toBeLessThan(size);
      expect(elapsed).toBeLessThan(20_000);
      const seen = events(server.lines);
      expect(seen).toContain("server.connections_abandoned");
      expect(seen.indexOf("server.connections_abandoned")).toBeLessThan(
        seen.indexOf("server.stopped"),
      );
    },
    PROCESS_BOUND_MS + 50_000,
  );
});
