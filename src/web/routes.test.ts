import { describe, expect, test } from "bun:test";

import { APPLICATIONS } from "../content/applications";
import { checkCopy, checkInternalLinks, findInlineStyles } from "./gates";
import { type ForgeInput, fileOf, libreRoutes, renderRoute } from "./routes";

const forge: ForgeInput = {
  bricks: [
    {
      project: "project-governance",
      title: "Gouvernance",
      lead: "Les décisions écrites.",
      body: "<h1>Gouvernance</h1><p>Corps.</p>",
    },
  ],
  proofs: "<h1>Preuves</h1>",
  licences: "<h1>Licences</h1>",
  deploy: "<h1>Déployer</h1>",
  signal: '<h1>Signaler</h1><p><a href="/corrections">journal</a></p>',
  corrections: "<h1>Journal des corrections</h1>",
};
const routes = libreRoutes(forge);
const pages = routes.map((entry) => ({ entry, html: renderRoute(entry) }));

describe("route table (plan, Task 7)", () => {
  test("paths are unique, end with a slash, and map to their output file", () => {
    expect(new Set(routes.map((entry) => entry.path)).size).toBe(routes.length);
    for (const entry of routes) {
      if (entry.kind !== "error") expect(entry.path.endsWith("/")).toBe(true);
      expect(entry.file).toBe(fileOf(entry.path));
    }
    expect(fileOf("/")).toBe("index.html");
    expect(fileOf("/a-propos/")).toBe("a-propos/index.html");
    expect(fileOf("/404.html")).toBe("404.html");
  });

  test("covers the home, every application, the factory, the bricks and the subscription pages", () => {
    const paths = routes.map((entry) => entry.path);
    expect(paths).toContain("/");
    expect(
      paths.filter((path) => path.startsWith("/applications/") && path !== "/applications/"),
    ).toHaveLength(APPLICATIONS.length);
    expect(paths).toContain("/fabrique/briques/project-governance/");
    expect(paths.filter((path) => path.startsWith("/inscription/"))).toHaveLength(5);
  });

  test("leaves the old marketing paths out (ADR 0007 §10)", () => {
    const paths = routes.map((entry) => entry.path);
    for (const old of [
      "/mission/",
      "/methode/",
      "/produits/",
      "/offres/",
      "/gouvernance/",
      "/contribuer/",
    ]) {
      expect(paths).not.toContain(old);
    }
  });
});

describe("rendered pages", () => {
  test("every page has exactly one h1", () => {
    for (const { entry, html } of pages)
      expect([entry.path, html.match(/<h1\b/g)?.length]).toEqual([entry.path, 1]);
  });

  test("no page carries an inline style", () => {
    for (const { html } of pages) expect(findInlineStyles(html)).toEqual([]);
  });

  test("no page offers a download, a trial, an availability, a count or a progress", () => {
    const report = checkCopy(pages.map(({ entry, html }) => ({ page: entry.path, html })));
    expect(report.examined).toBe(routes.length);
    expect(report.violations).toEqual([]);
  });

  test("subscription and error pages are not indexed; the others are", () => {
    for (const { entry, html } of pages) {
      const hidden = entry.kind === "subscription" || entry.kind === "error";
      expect([entry.path, html.includes('content="noindex"')]).toEqual([entry.path, hidden]);
    }
  });

  test("every local link and asset reference resolves", () => {
    const files = new Map<string, string | Uint8Array>(
      pages.map(({ entry, html }) => [entry.file, html]),
    );
    for (const asset of [
      "assets/site.css",
      "assets/main.js",
      "assets/theme-init.js",
      "assets/volee.svg",
      "assets/martinet.svg",
    ]) {
      files.set(asset, "");
    }
    const report = checkInternalLinks(files);
    expect(report.examined).toBeGreaterThan(routes.length);
    expect(report.broken).toEqual([]);
  });

  test("an application page offers the waitlist for that application", () => {
    const application = APPLICATIONS[6];
    const page = pages.find(({ entry }) => entry.path === `/applications/${application?.slug}/`);
    expect(page?.html).toContain(`<input type="hidden" name="suivre" value="${application?.ref}">`);
  });
});
