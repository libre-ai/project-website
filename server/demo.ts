/**
 * Local demo of the site with its waitlist (plan, Task 14): an in-memory PostgreSQL (PGlite on
 * the wire protocol), the schema, an outbox of .eml files and the production server, on
 * http://localhost:<port>. Nothing leaves the machine and nothing survives a stop.
 * Entry point: server/demo-main.ts.
 */
import { parseArgs } from "node:util";

import { createServer } from "./http";
import { createLimiter } from "./limiter";
import { createLogger, type Logger } from "./log";
import { createOutboxMailer } from "./mailer";
import { createPgStore, migrate, type WaitlistStore } from "./store";
import { startTestDatabase } from "./test-database";

export interface DemoOptions {
  readonly port: number;
  readonly siteDirectory: string;
  readonly outboxDirectory: string;
}

// The demo's sender is a reserved example domain: the real one is a deployment setting.
const DEMO_SENDER = "Libre IA <liste@libre-ia.example>";
const PURGE_INTERVAL_MS = 3600 * 1000;

export function parseDemoArguments(args: readonly string[]): DemoOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      port: { type: "string", default: "8080" },
      site: { type: "string", default: "dist" },
      outbox: { type: "string", default: ".demo/outbox" },
    },
    strict: true,
  });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("demo.port_invalid");
  return { port, siteDirectory: values.site, outboxDirectory: values.outbox };
}

/** Deletes expired pending requests and logs how many, never which. */
export async function purgeOnce(store: WaitlistStore, logger: Logger, now: Date): Promise<number> {
  const purged = await store.purgeExpired(now);
  logger.event("subscription.purge", { purged });
  return purged;
}

export async function startDemo(
  options: DemoOptions,
  runtime: { readonly purgeIntervalMs?: number; readonly write?: (line: string) => void } = {},
): Promise<{ readonly url: string; stop(): Promise<void> }> {
  const database = await startTestDatabase();
  const sql = new Bun.SQL(database.url, { max: 1 });
  await migrate(sql);
  const store = createPgStore(sql);
  const logger = createLogger(runtime.write ?? console.log);
  const url = `http://localhost:${options.port}`;
  const server = await createServer({
    siteDirectory: options.siteDirectory,
    origin: url,
    redirectHosts: [],
    store,
    mailer: createOutboxMailer(options.outboxDirectory),
    from: DEMO_SENDER,
    limiter: createLimiter({ limit: 5, windowMs: 10 * 60 * 1000 }),
    logger,
    port: options.port,
    // The demo answers this machine only, never the local network.
    hostname: "localhost",
  });
  const purge = setInterval(
    () => purgeOnce(store, logger, new Date()),
    runtime.purgeIntervalMs ?? PURGE_INTERVAL_MS,
  );
  purge.unref();
  return {
    url,
    async stop() {
      clearInterval(purge);
      server.stop(true);
      await sql.close();
      await database.stop();
    },
  };
}
