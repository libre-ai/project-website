/**
 * The one Bun process of the site (ADR 0006): it serves the generated files with the security
 * header policy and holds the waitlist's only dynamic routes. Mirror hosts are redirected to the
 * canonical origin, any other host is refused. A subscription answers the same way whether the
 * address is new, pending or confirmed, so the form reveals nothing about who is on the list.
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { SECURITY_HEADERS } from "../src/headers";
import { escapeHtml } from "../src/security";
import type { Limiter } from "./limiter";
import type { Logger } from "./log";
import type { Mailer } from "./mailer";
import { confirmationMessage } from "./messages";
import type { WaitlistStore } from "./store";
import { parseSubscription } from "./subscription";
import { hashToken, newToken } from "./tokens";

export interface ServerOptions {
  readonly siteDirectory: string;
  /** Canonical origin, used for message links and redirects, e.g. https://libre-ia.fr */
  readonly origin: string;
  /** Hosts answered with a permanent redirect to the canonical origin. */
  readonly redirectHosts: readonly string[];
  readonly store: WaitlistStore;
  readonly mailer: Mailer;
  /** Sender of the waitlist messages, a deployment setting. */
  readonly from: string;
  readonly limiter: Limiter;
  readonly logger: Logger;
  readonly port: number;
  readonly hostname?: string;
  readonly clock?: () => Date;
  /** How a client is told apart for the limiter; the connection address by default. */
  readonly clientKey?: (request: Request, address: string | null) => string;
}

const MAX_FORM_BYTES = 4096;
const ONE_CLICK = "List-Unsubscribe=One-Click";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};
// Already compressed formats gain nothing from gzip.
const PRECOMPRESSED = new Set([".woff2"]);

interface StaticFile {
  readonly body: Uint8Array;
  readonly gzip: Uint8Array | null;
  readonly type: string;
}

async function loadSite(directory: string): Promise<Map<string, StaticFile>> {
  const files = new Map<string, StaticFile>();
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = join(entry.parentPath, entry.name);
    const path = `/${absolute
      .slice(directory.length + 1)
      .split("\\")
      .join("/")}`;
    const extension = extname(path);
    const body = new Uint8Array(await readFile(absolute));
    files.set(path, {
      body,
      gzip: PRECOMPRESSED.has(extension) ? null : Bun.gzipSync(body, { level: 9 }),
      type: TYPES[extension] ?? "application/octet-stream",
    });
  }
  if (!files.has("/index.html")) throw new Error("server.site_without_index");
  return files;
}

function withSecurity(headers: Record<string, string>): Headers {
  return new Headers({ ...SECURITY_HEADERS, ...headers });
}

const text = (status: number, body: string, headers: Record<string, string> = {}): Response =>
  new Response(body, {
    status,
    headers: withSecurity({ "Content-Type": "text/plain; charset=utf-8", ...headers }),
  });

const seeOther = (location: string): Response =>
  new Response(null, { status: 303, headers: withSecurity({ Location: location }) });

function resolvePath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  if (decoded.split("/").some((segment) => segment === "..")) return null;
  return decoded.endsWith("/") ? `${decoded}index.html` : decoded;
}

async function readLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_FORM_BYTES) return null;
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > MAX_FORM_BYTES) return null;
  return new TextDecoder().decode(body);
}

function unsubscribePage(token: string): string {
  const action = escapeHtml(`/desinscrire?jeton=${encodeURIComponent(token)}`);
  return [
    "<!doctype html>",
    '<html lang="fr">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex"><title>Quitter la liste d\'attente, Libre IA</title>',
    '<link rel="stylesheet" href="/assets/site.css"></head>',
    '<body><main class="page-inscription"><h1>Quitter la liste d\'attente</h1>',
    "<p>Votre adresse sera effacée de la liste, sans autre conservation.</p>",
    `<form method="post" action="${action}"><button type="submit">Me désinscrire</button></form>`,
    "</main></body></html>",
    "",
  ].join("\n");
}

export async function createServer(options: ServerOptions): Promise<ReturnType<typeof Bun.serve>> {
  const site = await loadSite(options.siteDirectory);
  const canonical = new URL(options.origin);
  const clock = options.clock ?? (() => new Date());
  const clientKey = options.clientKey ?? ((_request, address) => address ?? "unknown");
  const log = options.logger;

  function serveStatic(request: Request, pathname: string): Response {
    const path = resolvePath(pathname);
    const direct = path === null ? undefined : site.get(path);
    const file = direct ?? site.get(`${path ?? ""}/index.html`) ?? site.get("/404.html");
    const status =
      direct !== undefined || (path !== null && site.has(`${path}/index.html`)) ? 200 : 404;
    if (file === undefined) return text(404, "Introuvable");
    const gzip =
      file.gzip !== null && (request.headers.get("accept-encoding") ?? "").includes("gzip");
    const headers: Record<string, string> = {
      "Content-Type": file.type,
      "Cache-Control": pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    };
    if (file.gzip !== null) headers.Vary = "Accept-Encoding";
    if (gzip) headers["Content-Encoding"] = "gzip";
    const body = request.method === "HEAD" ? null : gzip ? file.gzip : file.body;
    return new Response(body, { status, headers: withSecurity(headers) });
  }

  async function subscribe(request: Request, address: string | null): Promise<Response> {
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("application/x-www-form-urlencoded")) return text(415, "Format refusé");
    const site = request.headers.get("sec-fetch-site");
    if (site !== null && site !== "same-origin") return text(403, "Origine refusée");
    const body = await readLimited(request);
    if (body === null) return text(413, "Demande trop longue");
    if (!options.limiter.allow(clientKey(request, address), clock().getTime())) {
      log.event("subscription.rate_limited");
      return text(429, "Trop de demandes. Réessayez dans quelques minutes.");
    }
    const form = new FormData();
    for (const [name, value] of new URLSearchParams(body)) form.append(name, value);
    const parsed = parseSubscription(form);
    if (!parsed.ok) {
      log.event(`subscription.${parsed.reason === "honeypot" ? "honeypot" : "invalid"}`, {
        reason: parsed.reason,
      });
      return seeOther(
        parsed.reason === "honeypot" ? "/inscription/merci/" : "/inscription/erreur/",
      );
    }
    const confirm = newToken();
    const unsubscribe = newToken();
    const outcome = await options.store.request(
      parsed.value,
      confirm.hash,
      unsubscribe.hash,
      clock(),
    );
    log.event("subscription.request", { outcome });
    if (outcome !== "already-confirmed") {
      try {
        await options.mailer.send(
          confirmationMessage({
            from: options.from,
            to: parsed.value.email,
            confirmUrl: `${canonical.origin}/confirmer?jeton=${confirm.token}`,
            unsubscribeUrl: `${canonical.origin}/desinscrire?jeton=${unsubscribe.token}`,
          }),
        );
      } catch {
        log.event("mail.failed");
        return seeOther("/inscription/erreur/");
      }
    }
    return seeOther("/inscription/merci/");
  }

  async function confirm(url: URL): Promise<Response> {
    const token = url.searchParams.get("jeton") ?? "";
    const outcome =
      token === "" ? "invalid" : await options.store.confirm(hashToken(token), clock());
    log.event("subscription.confirm", { outcome });
    return seeOther(
      outcome === "confirmed" ? "/inscription/confirmee/" : "/inscription/lien-invalide/",
    );
  }

  async function unsubscribe(request: Request, url: URL): Promise<Response> {
    const body = await readLimited(request);
    if (body === null) return text(413, "Demande trop longue");
    const token = url.searchParams.get("jeton") ?? "";
    const outcome = token === "" ? "invalid" : await options.store.unsubscribe(hashToken(token));
    log.event("subscription.unsubscribe", { outcome });
    // A mail client's one-click request (RFC 8058) expects a plain success, not a page.
    if (body.trim() === ONE_CLICK) return text(200, "Désinscription prise en compte.");
    return seeOther(
      outcome === "deleted" ? "/inscription/desinscrit/" : "/inscription/lien-invalide/",
    );
  }

  async function route(request: Request, address: string | null): Promise<Response> {
    const url = new URL(request.url);
    const host = (request.headers.get("host") ?? url.host).toLowerCase().replace(/:\d+$/, "");
    if (host !== canonical.hostname) {
      if (options.redirectHosts.includes(host)) {
        return new Response(null, {
          status: 301,
          headers: withSecurity({ Location: `${canonical.origin}${url.pathname}${url.search}` }),
        });
      }
      return text(421, "Hôte inconnu");
    }
    const method = request.method;
    if (url.pathname === "/inscription" && method === "POST") return subscribe(request, address);
    if (url.pathname === "/confirmer" && method === "GET") return confirm(url);
    if (url.pathname === "/desinscrire" && method === "GET") {
      return new Response(unsubscribePage(url.searchParams.get("jeton") ?? ""), {
        headers: withSecurity({
          "Content-Type": TYPES[".html"] ?? "",
          "Cache-Control": "no-store",
        }),
      });
    }
    if (url.pathname === "/desinscrire" && method === "POST") return unsubscribe(request, url);
    if (method === "GET" || method === "HEAD") return serveStatic(request, url.pathname);
    return text(405, "Méthode refusée", { Allow: "GET, HEAD" });
  }

  return Bun.serve({
    port: options.port,
    ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
    maxRequestBodySize: 64 * 1024,
    async fetch(request, server) {
      try {
        return await route(request, server.requestIP(request)?.address ?? null);
      } catch {
        log.event("server.error");
        return text(500, "Erreur du serveur");
      }
    },
  });
}
