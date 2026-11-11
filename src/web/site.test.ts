import { beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { APPLICATIONS } from "../content/applications";
import { parseDeployFacts } from "../deploy";
import { diffOutputs } from "../determinism";
import { parseLicences } from "../licences";
import { loadPresentations } from "../presentation";
import { type ProjectCard, parseProjectCard } from "../project-card";
import { buildLibreSite, type LibreSiteInput, SITE_ORIGIN } from "./site";

const cardsDirectory = join(import.meta.dir, "../data/cards");

async function snapshotCards(): Promise<ProjectCard[]> {
  const names = (await readdir(cardsDirectory))
    .filter((name) => name.endsWith(".project.v1.yaml"))
    .sort();
  return Promise.all(
    names.map(async (name) =>
      parseProjectCard(Bun.YAML.parse(await readFile(join(cardsDirectory, name), "utf8"))),
    ),
  );
}

const fonts = new Map<string, Uint8Array>([
  ["assets/fonts/bricolage-grotesque-latin-wght-normal.woff2", new Uint8Array(1000)],
  ["assets/fonts/source-sans-3-latin-wght-normal.woff2", new Uint8Array(1000)],
  ["assets/fonts/LICENSE-bricolage-grotesque.txt", new Uint8Array(10)],
  ["assets/fonts/LICENSE-source-sans-3.txt", new Uint8Array(10)],
]);

let input: LibreSiteInput;
let built: Awaited<ReturnType<typeof buildLibreSite>>;

beforeAll(async () => {
  input = { cards: await snapshotCards(), presentations: [], extras: {}, priorProofs: [], fonts };
  built = await buildLibreSite(input);
});

describe("buildLibreSite (plan, Task 9)", () => {
  test("writes every page, the assets, the sitemap and robots", () => {
    for (const path of [
      "index.html",
      "applications/index.html",
      "fabrique/index.html",
      "rejoindre/index.html",
      "preuves/index.html",
      "404.html",
      "assets/site.css",
      "assets/main.js",
      "assets/theme-init.js",
      "assets/volee.svg",
      "assets/martinet.svg",
      "sitemap.xml",
      "robots.txt",
      ...fonts.keys(),
    ]) {
      expect([path, built.files.has(path)]).toEqual([path, true]);
    }
    expect(
      [...built.files.keys()].filter(
        (path) => path.startsWith("applications/") && path !== "applications/index.html",
      ),
    ).toHaveLength(APPLICATIONS.length);
    expect(built.report.bricks).toBe(input.cards.length);
  });

  test("serves a minified stylesheet that carries the hoisted demo rules", () => {
    const css = String(built.files.get("assets/site.css"));
    expect(css).not.toContain("\n  ");
    expect(css).toMatch(/\.s-p01-1\{/);
  });

  test("the sitemap lists pages and forge pages at the canonical origin, never subscription pages", () => {
    const sitemap = String(built.files.get("sitemap.xml"));
    expect(SITE_ORIGIN).toBe("https://libre-ia.fr");
    expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
    expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/preuves/</loc>`);
    expect(sitemap).not.toContain("/inscription/");
    expect(sitemap).not.toContain("404");
    expect(String(built.files.get("robots.txt"))).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  test("reports every gate with what it examined, and the proofs page lists them", () => {
    const { report } = built;
    expect(report.pages).toBeGreaterThan(APPLICATIONS.length);
    // Every page but the proofs page, which is rendered afterwards from these very counters.
    expect(report.inlineStyles).toEqual({ examined: report.pages - 1, violations: 0 });
    expect(report.copy.violations).toBe(0);
    expect(report.links.broken).toBe(0);
    expect(report.links.examined).toBeGreaterThan(report.pages);
    expect(report.budget.violations).toBe(0);
    expect(report.assets.violations).toBe(0);
    const proofs = String(built.files.get("preuves/index.html"));
    for (const gate of ["ADR 0005", "ADR 0007", "Liens internes", "Poids transféré"]) {
      expect(proofs).toContain(gate);
    }
  });

  test("refuses a card that fails its own gates", async () => {
    const [first, ...rest] = input.cards;
    if (first === undefined) throw new Error("no card");
    const broken = { ...first, limits: [] };
    await expect(buildLibreSite({ ...input, cards: [broken, ...rest] })).rejects.toThrow(
      "site.gate_refused",
    );
  });

  test("two assemblies of the same input write the same bytes", async () => {
    const again = await buildLibreSite(input);
    expect(diffOutputs(built.files, again.files)).toEqual([]);
  });
});

describe("forge pages from the versioned data", () => {
  test("licences, deploy and presentations render, and an orphan presentation is refused", async () => {
    const data = join(import.meta.dir, "../data");
    const licenceNames = (await readdir(join(data, "licences")))
      .filter((name) => name.endsWith(".REUSE.toml"))
      .sort();
    const rows = await Promise.all(
      licenceNames.map(async (name) =>
        parseLicences(
          name.replace(".REUSE.toml", ""),
          await readFile(join(data, "licences", name), "utf8"),
        ),
      ),
    );
    const deployText = await readFile(join(data, "deploy/LOCAL-COMPOSITION.md"), "utf8");
    const presentations = await loadPresentations(
      join(import.meta.dir, "../../docs/presentations"),
    );
    const full: LibreSiteInput = {
      ...input,
      presentations,
      extras: {
        licences: { rows, commits: new Map(rows.map((row) => [row.repository, "0".repeat(40)])) },
        deploy: { facts: parseDeployFacts(deployText), commit: "0".repeat(40) },
      },
    };
    const site = await buildLibreSite(full);
    expect(String(site.files.get("licences/index.html"))).toContain("REUSE.toml");
    expect(String(site.files.get("deployer/index.html"))).not.toContain(
      "Aucune donnée de déploiement",
    );
    expect(String(site.files.get("preuves/index.html"))).toContain(`Présentations relues`);

    const [first] = presentations;
    if (first === undefined) throw new Error("no presentation");
    await expect(
      buildLibreSite({
        ...full,
        presentations: [...presentations, { ...first, project: "inconnu" }],
      }),
    ).rejects.toThrow("presentation.unknown_project:inconnu");
  });
});
