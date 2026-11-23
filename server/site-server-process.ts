/**
 * Starts the served runtime, the Rust binary `site-server` (ADR 0009), as a child process for the
 * local demo and the parity test. The binary is built by `cargo build --locked --bin
 * site-server` (`bun run test`, `bun run demo` and `bun run test:e2e` build it first); an absent
 * binary fails, it is never replaced by the Bun reference.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const SITE_SERVER_BINARY = join(import.meta.dir, "..", "target", "debug", "site-server");

export interface SiteServerProcess {
  readonly port: number;
  /** The JSON log lines written so far, the start line included. */
  readonly lines: string[];
  /** Asks for a graceful stop (SIGTERM) and resolves with the exit code once it has exited. */
  stop(): Promise<number>;
}

const ROOT = join(import.meta.dir, "..");

/** The crate's own sources: every file rustc reads for the binary (`policy.json` is embedded). */
export const SITE_SERVER_SOURCES = join(ROOT, "crates", "site-server");

/** The manifests that fix the dependencies, features and profile the binary is built with. */
export const SITE_SERVER_MANIFESTS: readonly string[] = [
  join(SITE_SERVER_SOURCES, "Cargo.toml"),
  join(ROOT, "Cargo.toml"),
  join(ROOT, "Cargo.lock"),
];

/** The newest modification time among the `.rs` files and `policy.json` under `sources`. */
function newestSource(sources: string): number {
  let newest = 0;
  for (const entry of readdirSync(sources, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".rs") && entry.name !== "policy.json") continue;
    newest = Math.max(newest, statSync(join(entry.parentPath, entry.name)).mtimeMs);
  }
  if (newest === 0) throw new Error(`site_server.sources_missing:${sources}`);
  return newest;
}

/** The newest modification time among `manifests`; an absent one is a failure, never old. */
function newestManifest(manifests: readonly string[]): number {
  let newest = 0;
  for (const manifest of manifests) {
    if (!existsSync(manifest)) throw new Error(`site_server.sources_missing:${manifest}`);
    newest = Math.max(newest, statSync(manifest).mtimeMs);
  }
  return newest;
}

/**
 * Cargo's own verdict on the binary: whether it is fresh against everything cargo fingerprints.
 * It runs the build, offline, so a binary that the manifests outdated is relinked on the way.
 */
export function cargoSaysFresh(): boolean {
  const run = Bun.spawnSync(
    ["cargo", "build", "--locked", "--offline", "--bin", "site-server", "--message-format=json"],
    { cwd: ROOT, stdout: "pipe", stderr: "ignore" },
  );
  if (run.exitCode !== 0) throw new Error(`site_server.cargo_failed:${run.exitCode}`);
  return binaryFreshIn(run.stdout.toString());
}

/** Whether cargo's JSON messages report the `site-server` binary as fresh (not rebuilt). */
export function binaryFreshIn(messages: string): boolean {
  return messages
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map(
      (line) =>
        JSON.parse(line) as { reason?: string; target?: { name?: string }; fresh?: boolean },
    )
    .some(
      (message) =>
        message.reason === "compiler-artifact" &&
        message.target?.name === "site-server" &&
        message.fresh === true,
    );
}

/**
 * The binary to run, refused when absent or older than its sources: a `bun test` run without
 * the build of `bun run test` would otherwise test a binary that no longer matches the code.
 * Cargo rewrites the binary whenever a crate source is newer than its last build, so their times
 * decide. A manifest is different: cargo compares its content, and a manifest rewritten without
 * a change cargo cares about leaves the binary older than it and still fresh. When a manifest is
 * newer than the binary, cargo is asked; refusing on the time alone would refuse a fresh binary
 * that no build can make newer.
 */
export function requireBinary(
  binary: string = SITE_SERVER_BINARY,
  sources: string = SITE_SERVER_SOURCES,
  manifests: readonly string[] = SITE_SERVER_MANIFESTS,
  freshByCargo: () => boolean = cargoSaysFresh,
): string {
  if (!existsSync(binary)) throw new Error(`site_server.binary_missing:${binary}`);
  const built = statSync(binary).mtimeMs;
  if (built < newestSource(sources) || (built < newestManifest(manifests) && !freshByCargo())) {
    throw new Error(
      `site_server.binary_stale:${binary} (run cargo build --locked --bin site-server)`,
    );
  }
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
    env: {
      PATH: process.env.PATH ?? "",
      POSTGRESQL_ADDON_URI: databaseUrl,
      // The test databases are in-memory servers on the loopback, without TLS.
      POSTGRESQL_ALLOW_INSECURE_LOCAL: "1",
    },
    stdout: "pipe",
    stderr: "inherit",
  });
  const lines: string[] = [];
  await collect(child.stdout, lines, () => {});
  return { code: await child.exited, lines };
}
