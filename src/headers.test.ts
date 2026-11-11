import { describe, expect, test } from "bun:test";

import { CONTENT_SECURITY_POLICY, cspDirectives, SECURITY_HEADERS } from "./headers";

const directives = cspDirectives(CONTENT_SECURITY_POLICY);

describe("security header policy (ADR 0005, ADR 0006 §2)", () => {
  test("scripts come from the site only, never inline, never evaluated", () => {
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|https?:/);
  });

  test("the page connects to nothing and posts forms to the site only", () => {
    expect(directives.get("connect-src")).toEqual(["'none'"]);
    expect(directives.get("form-action")).toEqual(["'self'"]);
  });

  test("styles, fonts and images are local; no plugin, no frame, no base override", () => {
    expect(directives.get("style-src")).toEqual(["'self'"]);
    expect(directives.get("font-src")).toEqual(["'self'"]);
    expect(directives.get("img-src")).toEqual(["'self'"]);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directives.get("base-uri")).toEqual(["'none'"]);
    expect(directives.get("default-src")).toEqual(["'self'"]);
  });

  test("declares each transport and isolation header", () => {
    expect(SECURITY_HEADERS).toMatchObject({
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
      "Strict-Transport-Security": "max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
  });

  test("HSTS starts at one day without subdomains, as the go-live plan requires", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).not.toContain("includeSubDomains");
  });
});
