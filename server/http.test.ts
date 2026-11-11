import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { SECURITY_HEADERS } from "../src/headers";
import { createServer } from "./http";
import { createLimiter } from "./limiter";
import { createLogger } from "./log";
import { createOutboxMailer } from "./mailer";
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
    mailer: createOutboxMailer(outbox),
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

const messages = async (): Promise<string[]> => {
  const files = await readdir(outbox).catch(() => []);
  return Promise.all(files.sort().map((name) => readFile(join(outbox, name), "utf8")));
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

  test("serves directory indexes, typed and cached by kind", async () => {
    const home = await fetch(`${base}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(home.headers.get("cache-control")).toBe("no-cache");
    expect(await (await fetch(`${base}/applications/`)).text()).toContain("Applications");
    const css = await fetch(`${base}/assets/site.css`);
    expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(css.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
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
    await rm(outbox, { recursive: true, force: true });
    const response = await post("/inscription", "courriel=a%40example.org");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/inscription/merci/");
    expect(await messages()).toEqual([]);
  });

  test("a filled honeypot answers 303 merci and stores nothing", async () => {
    const response = await post("/inscription", "courriel=a%40example.org&site=x");
    expect(response.headers.get("location")).toBe("/inscription/merci/");
    expect(await sql`select * from subscribers`).toHaveLength(0);
    expect(await messages()).toEqual([]);
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
  test("a malformed percent-encoding is a 404, not a crash", async () => {
    expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(404);
  });

  test("a failed send answers erreur and keeps the request pending, so a retry works", async () => {
    const failures: string[] = [];
    const broken = await createServer({
      siteDirectory: join(workspace, "site"),
      origin: "http://127.0.0.1",
      redirectHosts: [],
      store: createPgStore(sql),
      mailer: {
        send: async () => {
          throw new Error("smtp down");
        },
      },
      from: "Libre IA <liste@libre-ia.example>",
      limiter: createLimiter({ limit: 5, windowMs: 1000 }),
      logger: createLogger((line) => failures.push(line)),
      port: 0,
      hostname: "127.0.0.1",
    });
    try {
      const response = await fetch(`http://127.0.0.1:${broken.port}/inscription`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "courriel=a%40example.org",
      });
      expect(response.headers.get("location")).toBe("/inscription/erreur/");
      const states = (await sql`select state from subscribers`) as { state: string }[];
      expect(states.map((row) => row.state)).toEqual(["pending"]);
      expect(failures.map((line) => JSON.parse(line).event)).toContain("mail.failed");
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
