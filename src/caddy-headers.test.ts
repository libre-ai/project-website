import { describe, expect, test } from "bun:test";

import { checkSecurityHeaders } from "./caddy-headers";

const caddyfile = await Bun.file(new URL("../Caddyfile", import.meta.url)).text();

describe("Caddyfile security headers (G6, FR-08 : CSP sans script ni connexion tierce)", () => {
  test("the committed Caddyfile passes the header contract", () => {
    const report = checkSecurityHeaders(caddyfile);
    expect(report.violations).toEqual([]);
    expect(report.examined).toBeGreaterThan(5);
  });

  test("refuses a CSP that allows inline or remote scripts", () => {
    const weakened = caddyfile.replace("script-src 'none'", "script-src 'self' 'unsafe-inline'");
    expect(checkSecurityHeaders(weakened).violations).toContain("header.csp_script_src");
  });

  test("refuses a CSP that allows outgoing connections", () => {
    const weakened = caddyfile.replace("connect-src 'none'", "connect-src 'self' https:");
    expect(checkSecurityHeaders(weakened).violations).toContain("header.csp_connect_src");
  });

  test("refuses a form that could submit data", () => {
    const weakened = caddyfile.replace("form-action 'none'", "form-action 'self'");
    expect(checkSecurityHeaders(weakened).violations).toContain("header.csp_form_action");
  });

  test("refuses a missing HSTS header", () => {
    const weakened = caddyfile.replace(/Strict-Transport-Security[^\n]*\n/, "");
    expect(checkSecurityHeaders(weakened).violations).toContain("header.hsts_missing");
  });
});
