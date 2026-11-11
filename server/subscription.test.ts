import { describe, expect, test } from "bun:test";

import { normalizeEmail } from "./email";
import { parseSubscription } from "./subscription";
import { hashToken, newToken } from "./tokens";

describe("normalizeEmail (ADR 0006 §3)", () => {
  test("trims and lowercases the domain only, keeping the local part as written", () => {
    expect(normalizeEmail("  Marie.Dupont@Example.ORG ")).toBe("Marie.Dupont@example.org");
  });

  test("keeps a plus label", () => {
    expect(normalizeEmail("a+liste@example.org")).toBe("a+liste@example.org");
  });

  test("converts an internationalised domain to its ASCII form", () => {
    expect(normalizeEmail("a@exämple.example")).toBe("a@xn--exmple-cua.example");
  });

  test.each([
    ["no at sign", "example.org"],
    ["two at signs", "a@b@example.org"],
    ["an empty local part", "@example.org"],
    ["an empty domain", "a@"],
    ["a domain without a dot", "a@localhost"],
    ["an inner space", "a b@example.org"],
    ["a control character", "a\u0000@example.org"],
    ["a line break inside the local part", "a\r\nBcc:b@example.org"],
    ["a line break after the domain", "a@example.org\r\nBcc"],
  ])("refuses %s", (_case, input) => {
    expect(normalizeEmail(input)).toBeNull();
  });

  test("refuses more than 254 bytes once normalised", () => {
    const local = "a".repeat(64);
    const domain = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(50)}.example.org`;
    expect(new TextEncoder().encode(`${local}@${domain}`).length).toBeGreaterThan(254);
    expect(normalizeEmail(`${local}@${domain}`)).toBeNull();
  });

  test("refuses a local part over 64 bytes", () => {
    expect(normalizeEmail(`${"a".repeat(65)}@example.org`)).toBeNull();
  });
});

describe("tokens", () => {
  test("a token is 43 base64url characters and differs from its digest", () => {
    const { token, hash } = newToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashToken(token)).toBe(hash);
  });

  test("two tokens differ", () => {
    expect(newToken().token).not.toBe(newToken().token);
  });
});

const form = (fields: readonly (readonly [string, string])[]): FormData => {
  const data = new FormData();
  for (const [name, value] of fields) data.append(name, value);
  return data;
};

describe("parseSubscription", () => {
  test("accepts an address with interests, a followed application and the tester choice", () => {
    const result = parseSubscription(
      form([
        ["courriel", "a@example.org"],
        ["univers", "s-informer"],
        ["univers", "apprendre"],
        ["suivre", "P07"],
        ["testeur", "oui"],
      ]),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        email: "a@example.org",
        universes: ["apprendre", "s-informer"],
        follow: "P07",
        tester: true,
      },
    });
  });

  test("an address alone is enough", () => {
    expect(parseSubscription(form([["courriel", "a@example.org"]]))).toEqual({
      ok: true,
      value: { email: "a@example.org", universes: [], follow: null, tester: false },
    });
  });

  test("a filled honeypot is refused as honeypot, before anything else", () => {
    expect(
      parseSubscription(
        form([
          ["courriel", "nope"],
          ["site", "x"],
        ]),
      ),
    ).toEqual({ ok: false, reason: "honeypot" });
  });

  test("a malformed or missing address is refused as email", () => {
    expect(parseSubscription(form([["courriel", "nope"]]))).toEqual({ ok: false, reason: "email" });
    expect(parseSubscription(form([]))).toEqual({ ok: false, reason: "email" });
  });

  test("an unknown universe, an unknown application or a repeated field is refused as field", () => {
    expect(
      parseSubscription(
        form([
          ["courriel", "a@example.org"],
          ["univers", "inconnu"],
        ]),
      ),
    ).toEqual({
      ok: false,
      reason: "field",
    });
    expect(
      parseSubscription(
        form([
          ["courriel", "a@example.org"],
          ["suivre", "P41"],
        ]),
      ),
    ).toEqual({
      ok: false,
      reason: "field",
    });
    expect(
      parseSubscription(
        form([
          ["courriel", "a@example.org"],
          ["courriel", "b@example.org"],
        ]),
      ),
    ).toEqual({ ok: false, reason: "field" });
  });

  test("an unexpected field is refused as field", () => {
    expect(
      parseSubscription(
        form([
          ["courriel", "a@example.org"],
          ["role", "admin"],
        ]),
      ),
    ).toEqual({
      ok: false,
      reason: "field",
    });
  });

  test("tester is true only for oui", () => {
    const parsed = parseSubscription(
      form([
        ["courriel", "a@example.org"],
        ["testeur", "yes"],
      ]),
    );
    expect(parsed).toEqual({ ok: false, reason: "field" });
  });

  test("a repeated universe counts once", () => {
    const parsed = parseSubscription(
      form([
        ["courriel", "a@example.org"],
        ["univers", "apprendre"],
        ["univers", "apprendre"],
      ]),
    );
    expect(parsed.ok && parsed.value.universes).toEqual(["apprendre"]);
  });
});
