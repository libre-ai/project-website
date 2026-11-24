import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseDemoArguments, startDemo } from "./demo";

let workspace: string;
// A database and a child process start here: the default 5 s bound fails on a loaded machine.
const PROCESS_BOUND_MS = 30_000;

// A port free at the time of the call: the demo builds its message links from its port.
function freePort(): number {
  const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response(null) });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) throw new Error("no free port");
  return port;
}

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "demo-"));
  await mkdir(join(workspace, "site", "inscription", "merci"), { recursive: true });
  await writeFile(join(workspace, "site", "index.html"), "<!doctype html><title>Libre IA</title>");
  await writeFile(join(workspace, "site", "inscription", "merci", "index.html"), "merci");
});

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("local demo (plan, Task 14)", () => {
  test(
    "serves the home page and takes a subscription to confirmation, through site-server",
    async () => {
      const port = freePort();
      const outbox = join(workspace, "outbox");
      const demo = await startDemo({
        port,
        siteDirectory: join(workspace, "site"),
        outboxDirectory: outbox,
      });
      // The served runtime is the Rust binary (ADR 0009), never the Bun reference.
      const base = `http://127.0.0.1:${port}`;
      try {
        expect(demo.url).toBe(`http://localhost:${port}`);
        expect(demo.server.port).toBe(port);
        const home = await fetch(`${base}/`, { headers: { Host: `localhost:${port}` } });
        expect(await home.text()).toContain("Libre IA");
        const subscribed = await fetch(`${base}/inscription`, {
          method: "POST",
          redirect: "manual",
          headers: {
            Host: `localhost:${port}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Sec-Fetch-Site": "same-origin",
          },
          body: "courriel=a%40example.org",
        });
        expect(subscribed.headers.get("location")).toBe("/inscription/merci/");
        // The answer does not wait for the send (ADR 0006 §4): wait for the message, within a bound.
        let files: string[] = [];
        for (let attempt = 0; attempt < 100 && files.length === 0; attempt += 1) {
          files = await readdir(outbox).catch(() => []);
          if (files.length === 0) await Bun.sleep(20);
        }
        const [file = ""] = files;
        const raw = await readFile(join(outbox, file), "utf8");
        const token = new RegExp(
          `http://localhost:${port}/confirmer\\?jeton=([A-Za-z0-9_-]+)`,
        ).exec(raw)?.[1];
        expect(token).toBeDefined();
        const confirmed = await fetch(`${base}/confirmer?jeton=${token ?? ""}`, {
          redirect: "manual",
          headers: { Host: `localhost:${port}` },
        });
        expect(confirmed.headers.get("location")).toBe("/inscription/confirmee/");
      } finally {
        await demo.stop();
      }
    },
    PROCESS_BOUND_MS,
  );

  test(
    "an absent binary fails the start and stops the database",
    async () => {
      await expect(
        startDemo(
          { port: freePort(), siteDirectory: join(workspace, "site"), outboxDirectory: "x" },
          { binary: join(workspace, "absent-binary") },
        ),
      ).rejects.toThrow("site_server.binary_missing");
    },
    PROCESS_BOUND_MS,
  );

  test("reads its port, site and outbox from the command line, with defaults", () => {
    expect(parseDemoArguments([])).toEqual({
      port: 8080,
      siteDirectory: "dist",
      outboxDirectory: ".demo/outbox",
    });
    expect(parseDemoArguments(["--port", "9090", "--site", "site", "--outbox", "x"])).toEqual({
      port: 9090,
      siteDirectory: "site",
      outboxDirectory: "x",
    });
    expect(() => parseDemoArguments(["--port", "0"])).toThrow("demo.port_invalid");
  });
});
