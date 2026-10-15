import { describe, expect, test } from "bun:test";

import { licencesBody, parseLicences } from "./licences";

const reuse = (...ids: string[]) =>
  [
    "version = 1",
    ...ids.flatMap((id) => [
      "",
      "[[annotations]]",
      'path = ["**"]',
      `SPDX-License-Identifier = "${id}"`,
    ]),
  ].join("\n");

describe("parseLicences (S3.2)", () => {
  test("lists the distinct SPDX identifiers of a REUSE.toml, in order of appearance", () => {
    const row = parseLicences("alpha", reuse("EUPL-1.2", "CC-BY-4.0", "EUPL-1.2"));
    expect(row).toEqual({ repository: "alpha", identifiers: ["EUPL-1.2", "CC-BY-4.0"] });
  });

  test("accepts an SPDX expression as one identifier", () => {
    const row = parseLicences("alpha", reuse("MIT OR Apache-2.0"));
    expect(row.identifiers).toEqual(["MIT OR Apache-2.0"]);
  });

  test("a file without any readable licence refuses the build", () => {
    expect(() => parseLicences("alpha", "version = 1\n")).toThrow("licences.unreadable:alpha");
    expect(() => parseLicences("alpha", "not = [toml")).toThrow("licences.unreadable:alpha");
  });

  test("an identifier that is not SPDX-shaped refuses the build", () => {
    expect(() => parseLicences("alpha", reuse("<script>"))).toThrow("licences.unreadable:alpha");
  });
});

describe("licencesBody", () => {
  const rows = [
    { repository: "alpha", identifiers: ["EUPL-1.2", "CC-BY-4.0"] },
    { repository: "beta", identifiers: ["MIT"] },
  ];

  test("one row per repository with its identifiers and a link to the file at the pinned commit", () => {
    const html = licencesBody(
      rows,
      new Map([
        ["alpha", "abc123"],
        ["beta", "def456"],
      ]),
    );
    expect(html.match(/<tr>/g)).toHaveLength(1 + rows.length);
    // Each identifier stays on one line: a hyphen inside it is not a place to wrap (390 px defect).
    expect(html).toContain(
      '<span class="nowrap">EUPL-1.2</span>, <span class="nowrap">CC-BY-4.0</span>',
    );
    expect(html).toContain('href="https://github.com/libre-ai/alpha/blob/abc123/REUSE.toml"');
  });

  test("states what the identifiers are and what they are not", () => {
    const html = licencesBody(
      rows,
      new Map([
        ["alpha", "a"],
        ["beta", "b"],
      ]),
    );
    expect(html).toContain("REUSE.toml");
    expect(html).toContain("ne vaut pas conseil juridique");
  });

  test("a row without a pinned commit fails closed", () => {
    expect(() => licencesBody(rows, new Map([["alpha", "a"]]))).toThrow(
      "licences.pin_missing:beta",
    );
  });

  test("escapes the repository name", () => {
    const html = licencesBody(
      [{ repository: '"><script>1</script>', identifiers: ["MIT"] }],
      new Map([['"><script>1</script>', "x"]]),
    );
    expect(html).not.toContain("<script>");
  });
});
