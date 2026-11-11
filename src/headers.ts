/**
 * The site's single security header policy (ADR 0006 §2). The Bun server sends it on every
 * response and the Caddyfile of the static target must declare it unchanged (caddy-headers.ts).
 * Scripts and styles come from the site only (ADR 0005), the page opens no connection, and forms
 * post to the site only (the waitlist). HSTS starts at one day without subdomains, to be raised
 * after a green week in production.
 */

const CSP_DIRECTIVES: readonly (readonly [string, string])[] = [
  ["default-src", "'self'"],
  ["base-uri", "'none'"],
  ["connect-src", "'none'"],
  ["font-src", "'self'"],
  ["form-action", "'self'"],
  ["frame-ancestors", "'none'"],
  ["frame-src", "'none'"],
  ["img-src", "'self'"],
  ["manifest-src", "'none'"],
  ["media-src", "'none'"],
  ["object-src", "'none'"],
  ["script-src", "'self'"],
  ["style-src", "'self'"],
  ["worker-src", "'none'"],
];

export const CONTENT_SECURITY_POLICY = CSP_DIRECTIVES.map(
  ([name, value]) => `${name} ${value}`,
).join("; ");

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=86400",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

/** Directive name → its source list, for assertions on a policy string. */
export function cspDirectives(policy: string): ReadonlyMap<string, readonly string[]> {
  return new Map(
    policy
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter((tokens) => tokens.length > 0 && tokens[0] !== "")
      .map(([name = "", ...sources]) => [name, sources] as const),
  );
}
