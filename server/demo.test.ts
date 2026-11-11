import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseDemoArguments, purgeOnce, startDemo } from "./demo";
import { createLogger } from "./log";

let workspace: string;

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
  test("serves the home page and takes a subscription to confirmation", async () => {
    const port = freePort();
    const outbox = join(workspace, "outbox");
    const lines: string[] = [];
    const demo = await startDemo(
      { port, siteDirectory: join(workspace, "site"), outboxDirectory: outbox },
      { purgeIntervalMs: 20, write: (line) => lines.push(line) },
    );
    try {
      expect(demo.url).toBe(`http://localhost:${port}`);
      await Bun.sleep(60);
      expect(lines.map((line) => JSON.parse(line).event)).toContain("subscription.purge");
      expect(await (await fetch(`${demo.url}/`)).text()).toContain("Libre IA");
      const subscribed = await fetch(`${demo.url}/inscription`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-Fetch-Site": "same-origin",
        },
        body: "courriel=a%40example.org",
      });
      expect(subscribed.headers.get("location")).toBe("/inscription/merci/");
      const [file = ""] = await readdir(outbox);
      const raw = await readFile(join(outbox, file), "utf8");
      const link = new RegExp(`http://localhost:${port}/confirmer\\?jeton=[A-Za-z0-9_-]+`).exec(
        raw,
      )?.[0];
      expect(link).toBeDefined();
      const confirmed = await fetch(link ?? "", { redirect: "manual" });
      expect(confirmed.headers.get("location")).toBe("/inscription/confirmee/");
    } finally {
      await demo.stop();
    }
  });

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

  test("a purge logs how many requests it removed, never which", async () => {
    const lines: string[] = [];
    const store = {
      request: async () => "created" as const,
      confirm: async () => "invalid" as const,
      unsubscribe: async () => "invalid" as const,
      purgeExpired: async () => 3,
    };
    expect(
      await purgeOnce(
        store,
        createLogger((line) => lines.push(line)),
        new Date(),
      ),
    ).toBe(3);
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { event: "subscription.purge", purged: 3 },
    ]);
  });
});
