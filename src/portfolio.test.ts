import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { parsePortfolio } from "./portfolio";

// Read from the pinned install, like the build: no sibling checkout is assumed (S6.3).
const data = await Bun.file(
  join(process.cwd(), "node_modules/@libre-ai/governance/ecosystem/portfolio.v1.json"),
).json();

describe("current portfolio", () => {
  test("keeps the seventeen repositories in their five/nine/three groups", () => {
    const portfolio = parsePortfolio(data);
    expect(portfolio.items).toHaveLength(17);
    expect(portfolio.items.filter((item) => item.group === "products")).toHaveLength(5);
    expect(portfolio.items.filter((item) => item.group === "components")).toHaveLength(9);
    expect(portfolio.items.filter((item) => item.group === "project")).toHaveLength(3);
    expect(new Set(portfolio.items.map((item) => item.repository)).size).toBe(17);
    expect(portfolio.items.every((item) => item.status === "code_integration_local")).toBe(true);
  });

  test("refuses a missing item, duplicate identity, wrong group or invented release", () => {
    for (const mutate of [
      (value: typeof data) => value.items.pop(),
      (value: typeof data) => {
        value.items[1].repository = value.items[0].repository;
      },
      (value: typeof data) => {
        value.items[1].repositoryId = value.items[0].repositoryId;
      },
      (value: typeof data) => {
        value.items[0].group = "project";
      },
      (value: typeof data) => {
        value.items[0].status = "released";
      },
      (value: typeof data) => {
        value.items[0].repository = "other/unsafe";
      },
      (value: typeof data) => {
        value.items[0].role.fr = "";
      },
      (value: typeof data) => {
        value.authorizesPublication = true;
      },
    ]) {
      const changed = structuredClone(data);
      mutate(changed);
      expect(() => parsePortfolio(changed)).toThrow();
    }
  });
});
