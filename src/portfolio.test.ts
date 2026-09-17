import { describe, expect, test } from "bun:test";
import { parsePortfolio, renderPortfolio } from "./portfolio";

const data = await Bun.file(
  new URL("../../project-governance/ecosystem/portfolio.v1.json", import.meta.url),
).json();

describe("current portfolio", () => {
  test("keeps the twenty repositories in their eight/nine/three groups", () => {
    const portfolio = parsePortfolio(data);
    expect(portfolio.items).toHaveLength(20);
    expect(portfolio.items.filter((item) => item.group === "products")).toHaveLength(8);
    expect(portfolio.items.filter((item) => item.group === "components")).toHaveLength(9);
    expect(portfolio.items.filter((item) => item.group === "project")).toHaveLength(3);
    expect(new Set(portfolio.items.map((item) => item.repository)).size).toBe(20);
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

  test("renders bilingual source links and local status without old product promises", () => {
    const portfolio = parsePortfolio(data);
    for (const language of ["fr", "en"] as const) {
      const html = renderPortfolio(portfolio, language);
      expect((html.match(/class="product-card/g) ?? []).length).toBe(20);
      for (const item of portfolio.items) {
        expect(html).toContain(`https://github.com/libre-ai/${item.repository}`);
      }
      expect(html).toContain("Content-Security-Policy");
      expect(html).not.toContain("<script");
      expect(html).not.toContain("Possédez la fabrique");
      expect(html).not.toContain("couche-");
      expect(html).not.toContain("VÉRIFIÉ LE");
    }
  });

  test("escapes editorial content and never interpolates it into links", () => {
    const changed = structuredClone(data);
    changed.items[0].role.fr = '<img src="https://attacker.invalid/x" onerror="run()">';
    const html = renderPortfolio(parsePortfolio(changed), "fr");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="https://attacker.invalid');
  });
});
