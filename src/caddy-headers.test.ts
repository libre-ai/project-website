import { describe, expect, test } from "bun:test";

import { checkSecurityHeaders } from "./caddy-headers";
import { SECURITY_HEADERS } from "./headers";

const caddyfile = await Bun.file(new URL("../Caddyfile", import.meta.url)).text();

describe("Caddyfile headers equal the single policy (G6, ADR 0006 §2)", () => {
  test("the committed Caddyfile declares exactly the policy, header by header", () => {
    const report = checkSecurityHeaders(caddyfile);
    expect(report.violations).toEqual([]);
    expect(report.examined).toBe(Object.keys(SECURITY_HEADERS).length);
  });

  test("refuses a CSP that differs from the policy", () => {
    const weakened = caddyfile.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    expect(checkSecurityHeaders(weakened).violations).toEqual([
      "header.differs:Content-Security-Policy",
    ]);
  });

  test("refuses a missing header", () => {
    const weakened = caddyfile.replace(/\n\s*Strict-Transport-Security[^\n]*/, "");
    expect(checkSecurityHeaders(weakened).violations).toEqual([
      "header.missing:Strict-Transport-Security",
    ]);
  });

  test("refuses a header the policy does not declare", () => {
    const widened = caddyfile.replace(
      'X-Frame-Options "DENY"',
      'X-Frame-Options "DENY"\n\t\tAccess-Control-Allow-Origin "*"',
    );
    expect(checkSecurityHeaders(widened).violations).toEqual([
      "header.undeclared:Access-Control-Allow-Origin",
    ]);
  });

  test("a Caddyfile without a header block is a failure, not an empty pass", () => {
    expect(checkSecurityHeaders(":8080 {\n}\n").violations).toEqual(["header.block_missing"]);
  });
});
