/**
 * Starts the served runtime, the Rust binary `site-server` (ADR 0009), as a child process for the
 * local demo and the parity test. The binary is built by `cargo build --locked --bin
 * site-server` (`bun run test`, `bun run demo` and `bun run test:e2e` build it first); an absent
 * binary fails, it is never replaced by the Bun reference.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export const SITE_SERVER_BINARY = join(import.meta.dir, "..", "target", "debug", "site-server");

export interface SiteServerProcess {
  readonly port: number;
  /** The JSON log lines written so far, the start line included. */
  readonly lines: string[];
  /** Asks for a graceful stop (SIGTERM) and resolves with the exit code once it has exited. */
  stop(): Promise<number>;
}

export function requireBinary(binary: string = SITE_SERVER_BINARY): string {
  if (!existsSync(binary)) throw new Error(`site_server.binary_missing:${binary}`);
  return binary;
}

/** Reads a stream line by line into `lines`, resolving once it ends. */
async function collect(stream: ReadableStream<Uint8Array>, lines: string[], onLine: () => void) {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of stream) {
    pending += decoder.decode(chunk, { stream: true });
    let end = pending.indexOf("\n");
    while (end !== -1) {
      lines.push(pending.slice(0, end));
      pending = pending.slice(end + 1);
      onLine();
      end = pending.indexOf("\n");
    }
  }
  if (pending !== "") {
    lines.push(pending);
    onLine();
  }
}

/** The port of the start line `{"event":"server.listening","port":N}`, if `line` is it. */
export function listeningPort(line: string): number | null {
  try {
    const parsed = JSON.parse(line) as { event?: unknown; port?: unknown };
    return parsed.event === "server.listening" && typeof parsed.port === "number"
      ? parsed.port
      : null;
  } catch {
    return null;
  }
}

/**
 * Spawns the binary with exactly `environment` (nothing inherited but PATH), and waits for its
 * start line. A process that exits first, or stays silent past the bound, is a failure that
 * carries its log lines.
 */
export async function startSiteServer(
  environment: Readonly<Record<string, string>>,
  options: { readonly binary?: string; readonly startTimeoutMs?: number } = {},
): Promise<SiteServerProcess> {
  const child = Bun.spawn([requireBinary(options.binary)], {
    env: { PATH: process.env.PATH ?? "", ...environment },
    stdout: "pipe",
    stderr: "inherit",
  });
  const lines: string[] = [];
  const { promise: started, resolve: announce } = Promise.withResolvers<number>();
  const reading = collect(child.stdout, lines, () => {
    const port = listeningPort(lines[lines.length - 1] ?? "");
    if (port !== null) announce(port);
  });
  const bound = options.startTimeoutMs ?? 15_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    started.then((port) => ({ port })),
    child.exited.then((code) => ({ exited: code })),
    new Promise<{ timeout: true }>((resolve) => {
      timer = setTimeout(() => resolve({ timeout: true }), bound);
    }),
  ]);
  clearTimeout(timer);
  if (!("port" in outcome)) {
    child.kill("SIGKILL");
    await reading;
    throw new Error(`site_server.start_failed:${lines.join(" | ")}`);
  }
  return {
    port: outcome.port,
    lines,
    async stop() {
      child.kill("SIGTERM");
      const code = await child.exited;
      await reading;
      return code;
    },
  };
}

/** Runs `site-server purge` once against `databaseUrl`; resolves with its code and log lines. */
export async function purgeWithSiteServer(
  databaseUrl: string,
  binary?: string,
): Promise<{ readonly code: number; readonly lines: string[] }> {
  const child = Bun.spawn([requireBinary(binary), "purge"], {
    env: { PATH: process.env.PATH ?? "", POSTGRESQL_ADDON_URI: databaseUrl },
    stdout: "pipe",
    stderr: "inherit",
  });
  const lines: string[] = [];
  await collect(child.stdout, lines, () => {});
  return { code: await child.exited, lines };
}
