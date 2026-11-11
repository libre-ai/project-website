import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { SECURITY_HEADERS } from "../src/headers";
import { createServer } from "./http";
import { createLimiter } from "./limiter";
import { createLogger } from "./log";
import { createOutboxMailer, type Mailer } from "./mailer";
import { createPgStore, migrate } from "./store";
import { startTestDatabase, type TestDatabase } from "./test-database";

const SITE: Readonly<Record<string, string>> = {
  "index.html": "<!doctype html><title>Accueil</title>",
  "404.html": "<!doctype html><title>Introuvable</title>",
  "assets/site.css": "body{}",
  "applications/index.html": "<!doctype html><title>Applications</title>",
  "inscription/merci/index.html": "<!doctype html><title>Merci</title>",
};

let workspace: string;
let outbox: string;
// Sends started by the server. The answer never waits for a send (ADR 0006 §4), so a test that
// claims nothing was sent counts the calls, which happen before the answer, not the files.
let sends = 0;
const countingMailer = (inner: Mailer): Mailer => ({
  send(message) {
    sends += 1;
    return inner.send(message);
  },
});
let database: TestDatabase;
let sql: Bun.SQL;
let server: ReturnType<typeof Bun.serve>;
let base: string;
const logs: string[] = [];

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "site-"));
  for (const [path, content] of Object.entries(SITE)) {
    await mkdir(dirname(join(workspace, "site", path)), { recursive: true });
    await writeFile(join(workspace, "site", path), content);
  }
  outbox = join(workspace, "outbox");
  database = await startTestDatabase();
  sql = new Bun.SQL(database.url, { max: 1 });
  await migrate(sql);
  server = await createServer({
    siteDirectory: join(workspace, "site"),
    origin: "http://127.0.0.1",
    redirectHosts: ["libreia.fr", "www.libre-ia.fr"],
    store: createPgStore(sql),
    mailer: countingMailer(createOutboxMailer(outbox)),
    from: "Libre IA <liste@libre-ia.example>",
    limiter: createLimiter({ limit: 5, windowMs: 10 * 60 * 1000 }),
    logger: createLogger((line) => logs.push(line)),
    port: 0,
    hostname: "127.0.0.1",
    clientKey: (request) => request.headers.get("x-test-client") ?? "anonymous",
  });
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  server.stop(true);
  await sql.close();
  await database.stop();
  await rm(workspace, { recursive: true, force: true });
});

beforeEach(async () => {
  await sql`delete from subscribers`;
  await rm(outbox, { recursive: true, force: true });
});

let clients = 0;
// Each request speaks as a new client unless the test names one, so the limiter only bites
// where a test means it to.
function post(path: string, body: string, headers: Record<string, string> = {}) {
  clients += 1;
  return fetch(`${base}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Sec-Fetch-Site": "same-origin",
      "X-Test-Client": `client-${clients}`,
      ...headers,
    },
    body,
  });
}

// The messages in the outbox once at least `expected` are written: delivery runs after the
// answer, so a reader waits for it, within a bound.
const messages = async (expected = 1): Promise<string[]> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const files = await readdir(outbox).catch(() => []);
    if (files.length >= expected) {
      return Promise.all(files.sort().map((name) => readFile(join(outbox, name), "utf8")));
    }
    await Bun.sleep(20);
  }
  throw new Error(`outbox.timeout:${expected}`);
};

const linkIn = (raw: string, path: string): string => {
  const match = new RegExp(`http://127\\.0\\.0\\.1${path}\\?jeton=[A-Za-z0-9_-]+`).exec(raw);
  if (match === null) throw new Error(`no ${path} link`);
  return match[0].replace("http://127.0.0.1", base);
};

describe("static site", () => {
  test("every response carries the security headers", async () => {
    for (const path of ["/", "/assets/site.css", "/nope"]) {
      const response = await fetch(`${base}${path}`);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(response.headers.get(name)).toBe(value);
      }
    }
  });

  test("serves directory indexes, typed", async () => {
    const home = await fetch(`${base}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await (await fetch(`${base}/applications/`)).text()).toContain("Applications");
    const css = await fetch(`${base}/assets/site.css`);
    expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
  });

  // Asset names carry no content hash: a long-lived cache would keep last release's stylesheet
  // and script against this release's pages. Every file is revalidated against its digest.
  test("every file is revalidated, never cached as immutable", async () => {
    for (const path of ["/", "/assets/site.css", "/nope"]) {
      const response = await fetch(`${base}${path}`);
      expect(response.headers.get("cache-control")).toBe("no-cache");
    }
  });

  test("a file answers 304 to its own digest, and 200 with the body to any other", async () => {
    const identity = { "Accept-Encoding": "identity" };
    const digest = new Bun.CryptoHasher("sha256").update("body{}").digest("hex");
    const first = await fetch(`${base}/assets/site.css`, { headers: identity });
    const etag = first.headers.get("etag") ?? "";
    expect(etag).toBe(`"${digest}"`);
    for (const header of [etag, `W/${etag}`, `"0000", ${etag}`, "*"]) {
      const same = await fetch(`${base}/assets/site.css`, {
        headers: { ...identity, "If-None-Match": header },
      });
      expect(same.status).toBe(304);
      expect(await same.text()).toBe("");
      expect(same.headers.get("etag")).toBe(etag);
    }
    const other = await fetch(`${base}/assets/site.css`, {
      headers: { ...identity, "If-None-Match": '"0000"' },
    });
    expect(other.status).toBe(200);
    expect(await other.text()).toBe("body{}");
    const home = await fetch(`${base}/`, { headers: identity });
    expect(home.headers.get("etag")).not.toBe(etag);
  });

  test("the gzip representation has its own digest", async () => {
    const gzip = { "Accept-Encoding": "gzip" };
    const identityTag =
      (
        await fetch(`${base}/assets/site.css`, { headers: { "Accept-Encoding": "identity" } })
      ).headers.get("etag") ?? "";
    const compressed = await fetch(`${base}/assets/site.css`, { headers: gzip, decompress: false });
    const gzipTag = compressed.headers.get("etag") ?? "";
    expect(gzipTag).toBe(`${identityTag.slice(0, -1)}-gzip"`);
    const crossed = await fetch(`${base}/assets/site.css`, {
      headers: { ...gzip, "If-None-Match": identityTag },
      decompress: false,
    });
    expect(crossed.status).toBe(200);
    const same = await fetch(`${base}/assets/site.css`, {
      headers: { ...gzip, "If-None-Match": gzipTag },
      decompress: false,
    });
    expect(same.status).toBe(304);
  });

  test("a missing file carries no digest, so its 404 is never revalidated into a 304", async () => {
    const response = await fetch(`${base}/assets/absent.css`);
    expect(response.status).toBe(404);
    expect(response.headers.get("etag")).toBeNull();
  });

  test("compresses when the client accepts gzip", async () => {
    const response = await fetch(`${base}/`, {
      headers: { "Accept-Encoding": "gzip" },
      decompress: false,
    });
    expect(response.headers.get("content-encoding")).toBe("gzip");
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
  });

  test("an unknown path answers 404 with the generated page", async () => {
    const response = await fetch(`${base}/nope`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Introuvable");
  });

  test("a path escaping the site is refused", async () => {
    const response = await fetch(`${base}/..%2f..%2fetc/passwd`);
    expect(response.status).toBe(404);
  });

  test("another method than GET, HEAD or the waitlist POSTs answers 405", async () => {
    expect((await fetch(`${base}/`, { method: "DELETE" })).status).toBe(405);
    expect((await post("/", "x=1")).status).toBe(405);
  });
});

describe("hosts (ADR 0006 §1)", () => {
  test("a mirror host gets a permanent redirect to the canonical origin, path kept", async () => {
    const response = await fetch(`${base}/applications/?x=1`, {
      headers: { Host: "libreia.fr" },
      redirect: "manual",
    });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("http://127.0.0.1/applications/?x=1");
  });

  test("an unknown host is refused as misdirected", async () => {
    const response = await fetch(`${base}/`, { headers: { Host: "evil.example" } });
    expect(response.status).toBe(421);
  });
});

describe("waitlist (ADR 0006 §3-6)", () => {
  test("a valid subscription answers 303 merci and writes one confirmation", async () => {
    const response = await post(
      "/inscription",
      "courriel=a%40example.org&univers=apprendre&suivre=P07",
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/inscription/merci/");
    const sent = await messages();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("To: a@example.org\r\n");
  });

  test("confirm from the message link, then unsubscribe in one click", async () => {
    await post("/inscription", "courriel=a%40example.org");
    const [raw = ""] = await messages();
    const confirm = await fetch(linkIn(raw, "/confirmer"), { redirect: "manual" });
    expect(confirm.headers.get("location")).toBe("/inscription/confirmee/");
    const again = await fetch(linkIn(raw, "/confirmer"), { redirect: "manual" });
    expect(again.headers.get("location")).toBe("/inscription/lien-invalide/");
    const oneClick = await post(
      new URL(linkIn(raw, "/desinscrire")).pathname + new URL(linkIn(raw, "/desinscrire")).search,
      "List-Unsubscribe=One-Click",
      { "Sec-Fetch-Site": "cross-site" },
    );
    expect(oneClick.status).toBe(200);
    expect(await sql`select * from subscribers`).toHaveLength(0);
  });

  test("a known confirmed address answers the same 303 and writes nothing", async () => {
    await post("/inscription", "courriel=a%40example.org");
    const [raw = ""] = await messages();
    await fetch(linkIn(raw, "/confirmer"), { redirect: "manual" });
    const before = sends;
    const response = await post("/inscription", "courriel=a%40example.org");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/inscription/merci/");
    expect(sends).toBe(before);
  });

  test("a filled honeypot answers 303 merci and stores nothing", async () => {
    const before = sends;
    const response = await post("/inscription", "courriel=a%40example.org&site=x");
    expect(response.headers.get("location")).toBe("/inscription/merci/");
    expect(await sql`select * from subscribers`).toHaveLength(0);
    expect(sends).toBe(before);
  });

  test("an invalid request answers 303 erreur and stores nothing", async () => {
    const response = await post("/inscription", "courriel=nope");
    expect(response.headers.get("location")).toBe("/inscription/erreur/");
    expect(await sql`select * from subscribers`).toHaveLength(0);
  });

  test("the sixth request in ten minutes from one client gets 429", async () => {
    const same = { "X-Test-Client": "one-client" };
    for (let i = 0; i < 5; i += 1) {
      expect((await post("/inscription", `courriel=a${i}%40example.org`, same)).status).toBe(303);
    }
    expect((await post("/inscription", "courriel=b%40example.org", same)).status).toBe(429);
  });

  test("a cross-site POST is refused 403", async () => {
    const response = await post("/inscription", "courriel=a%40example.org", {
      "Sec-Fetch-Site": "cross-site",
    });
    expect(response.status).toBe(403);
  });

  test("a body over 4 KiB is refused 413 and a wrong content type 415", async () => {
    expect((await post("/inscription", `courriel=${"a".repeat(5000)}`)).status).toBe(413);
    expect((await post("/inscription", "{}", { "Content-Type": "application/json" })).status).toBe(
      415,
    );
  });

  test("GET /desinscrire shows a form and never deletes", async () => {
    await post("/inscription", "courriel=a%40example.org");
    const [raw = ""] = await messages();
    const page = await fetch(linkIn(raw, "/desinscrire"));
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('method="post"');
    expect(html).not.toMatch(/<script|style=/);
    expect(await sql`select * from subscribers`).toHaveLength(1);
  });

  test("a browser unsubscribe redirects to the confirmation page", async () => {
    await post("/inscription", "courriel=a%40example.org");
    const [raw = ""] = await messages();
    const link = new URL(linkIn(raw, "/desinscrire"));
    const response = await post(link.pathname + link.search, "");
    expect(response.headers.get("location")).toBe("/inscription/desinscrit/");
    expect(await sql`select * from subscribers`).toHaveLength(0);
  });

  test("logs carry no address, no token and no client address", async () => {
    await post("/inscription", "courriel=secret.person%40example.org");
    const [raw = ""] = await messages();
    const token = new URL(linkIn(raw, "/confirmer")).searchParams.get("jeton") ?? "";
    await fetch(linkIn(raw, "/confirmer"), { redirect: "manual" });
    const joined = logs.join("\n");
    expect(logs.length).toBeGreaterThan(0);
    expect(joined).not.toContain("@");
    expect(joined).not.toContain("secret.person");
    expect(joined).not.toContain(token);
    expect(joined).not.toContain("127.0.0.1");
  });
});

describe("limiter and logger", () => {
  test("the limiter allows a new window once the old one has passed", () => {
    const limiter = createLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.allow("k", 0)).toBe(true);
    expect(limiter.allow("k", 500)).toBe(false);
    expect(limiter.allow("k", 1001)).toBe(true);
  });

  test("the logger redacts any value shaped like an address", () => {
    const lines: string[] = [];
    createLogger((line) => lines.push(line)).event("x", { who: "a@example.org", count: 2 });
    expect(JSON.parse(lines[0] ?? "{}")).toEqual({ event: "x", who: "[retiré]", count: 2 });
  });
});

describe("failures", () => {
  test("a malformed percent-encoding is a 404 with the generated page, not a crash", async () => {
    const response = await fetch(`${base}/%E0%A4%A`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Introuvable");
  });

  // ADR 0006 §4: the answer is the same whatever the address. Waiting for a send that only a new
  // or pending address triggers would let the response time tell a confirmed address apart.
  test("the answer never waits for the send; a failed send is logged and the request stays pending, so a retry works", async () => {
    const failures: string[] = [];
    const releases: (() => void)[] = [];
    let attempts = 0;
    const broken = await createServer({
      siteDirectory: join(workspace, "site"),
      origin: "http://127.0.0.1",
      redirectHosts: [],
      store: createPgStore(sql),
      mailer: {
        send: () => {
          attempts += 1;
          return new Promise<void>((_resolve, reject) => {
            releases.push(() => reject(new Error("smtp down")));
          });
        },
      },
      from: "Libre IA <liste@libre-ia.example>",
      limiter: createLimiter({ limit: 5, windowMs: 1000 }),
      logger: createLogger((line) => failures.push(line)),
      port: 0,
      hostname: "127.0.0.1",
    });
    const subscribe = () =>
      fetch(`http://127.0.0.1:${broken.port}/inscription`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "courriel=a%40example.org",
      });
    try {
      // The send is still pending: the answer came anyway.
      const response = await subscribe();
      expect(response.headers.get("location")).toBe("/inscription/merci/");
      expect(attempts).toBe(1);

      for (const release of releases) release();
      for (
        let wait = 0;
        wait < 100 && !failures.some((line) => line.includes("mail.failed"));
        wait += 1
      ) {
        await Bun.sleep(10);
      }
      expect(failures.map((line) => JSON.parse(line).event)).toContain("mail.failed");
      const states = (await sql`select state from subscribers`) as { state: string }[];
      expect(states.map((row) => row.state)).toEqual(["pending"]);

      await subscribe();
      expect(attempts).toBe(2);
      for (const release of releases.splice(0)) release();
    } finally {
      broken.stop(true);
    }
  });

  test("a store failure answers 500 without detail and is logged", async () => {
    const failures: string[] = [];
    const failing = async (): Promise<never> => {
      throw new Error("connection refused to db.internal:5432");
    };
    const broken = await createServer({
      siteDirectory: join(workspace, "site"),
      origin: "http://127.0.0.1",
      redirectHosts: [],
      store: { request: failing, confirm: failing, unsubscribe: failing, purgeExpired: failing },
      mailer: createOutboxMailer(outbox),
      from: "Libre IA <liste@libre-ia.example>",
      limiter: createLimiter({ limit: 5, windowMs: 1000 }),
      logger: createLogger((line) => failures.push(line)),
      port: 0,
      hostname: "127.0.0.1",
    });
    try {
      const response = await fetch(`http://127.0.0.1:${broken.port}/confirmer?jeton=x`);
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("db.internal");
      expect(failures.map((line) => JSON.parse(line).event)).toEqual(["server.error"]);
    } finally {
      broken.stop(true);
    }
  });
});
