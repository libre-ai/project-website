/**
 * Local demo of the site with its waitlist (plan, Task 14): an in-memory PostgreSQL (PGlite on
 * the wire protocol), an outbox of .eml files and the served runtime — the Rust binary
 * `site-server` (ADR 0009) — on http://localhost:<port>, bound to the loopback address only.
 * Nothing leaves the machine and nothing survives a stop. It serves no user: it is the local
 * demo and the server of the end-to-end suite. Entry point: server/demo-main.ts.
 */
import { parseArgs } from "node:util";

import { type SiteServerProcess, startSiteServer } from "./site-server-process";
import { startTestDatabase } from "./test-database";

export interface DemoOptions {
  readonly port: number;
  readonly siteDirectory: string;
  readonly outboxDirectory: string;
}

// The demo's sender is a reserved example domain: the real one is a deployment setting.
const DEMO_SENDER = "Libre IA <liste@libre-ia.example>";
// The pool of the binary and the connections PGlite accepts: browsers load pages in parallel.
const DATABASE_CONNECTIONS = 4;

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

export async function startDemo(
  options: DemoOptions,
  runtime: { readonly binary?: string } = {},
): Promise<{ readonly url: string; readonly server: SiteServerProcess; stop(): Promise<void> }> {
  const database = await startTestDatabase({ maxConnections: DATABASE_CONNECTIONS });
  const url = `http://localhost:${options.port}`;
  let server: SiteServerProcess;
  try {
    server = await startSiteServer(
      {
        SITE_DIRECTORY: options.siteDirectory,
        SITE_ORIGIN: url,
        // The demo answers this machine only, never the local network.
        SITE_LISTEN: `127.0.0.1:${options.port}`,
        POSTGRESQL_ADDON_URI: database.url,
        POSTGRESQL_MAX_CONNECTIONS: String(DATABASE_CONNECTIONS),
        WAITLIST_FROM: DEMO_SENDER,
        WAITLIST_OUTBOX: options.outboxDirectory,
      },
      runtime.binary === undefined ? {} : { binary: runtime.binary },
    );
  } catch (error) {
    await database.stop();
    throw error;
  }
  return {
    url,
    server,
    async stop() {
      await server.stop();
      await database.stop();
    },
  };
}
