import { beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { APPLICATIONS } from "../content/applications";
import { parseDeployFacts } from "../deploy";
import { diffOutputs } from "../determinism";
import { parseLicences } from "../licences";
import { loadPresentations } from "../presentation";
import { type ProjectCard, parseProjectCard } from "../project-card";
import { escapeHtml } from "../security";
import { TRUST_BENCH_COPY, TRUST_BENCH_PATH, TRUST_BENCH_REPORT_PATH } from "../trust-bench";
import { loadTrustBench } from "../trust-bench-snapshot";
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

describe("the trust bench measure on /fabrique/ (from the pinned copy)", () => {
  interface RawLayer {
    readonly couche: string;
    readonly derivee_de: readonly string[] | null;
    readonly defauts_soumis: number;
    readonly defauts_attrapes: number;
    readonly apport_au_dela_du_moins_cher: number | null;
    readonly sains_soumis: number;
    readonly faux_positifs: number;
    readonly illisibles: number;
  }
  interface RawMeasure {
    readonly date: string;
    readonly depot: string;
    readonly revision: string;
    readonly corpus: { readonly defauts: number; readonly sains: number };
    readonly couches: readonly RawLayer[];
    readonly limites: readonly string[];
    readonly cas: readonly { readonly id: string; readonly attendu: boolean }[];
    readonly modeles: readonly { readonly nom: string; readonly quantification: string }[];
    readonly reference: { readonly condition: string };
    readonly second_passage: {
      readonly condition: string;
      readonly statut: string;
      readonly lignes_comparees: number;
      readonly bascules: readonly { readonly cas: string; readonly couche: string }[];
    };
  }

  const numbers = (cell: string | undefined): number[] =>
    (cell?.replace(/<[^>]+>/g, "").match(/\d+/g) ?? []).map(Number);

  test("every figure of every layer is the one the data carries", async () => {
    const data = join(import.meta.dir, "../data");
    // The expectation is read from the file itself, apart from the parser the page goes through.
    const source = JSON.parse(await readFile(join(data, TRUST_BENCH_COPY), "utf8")) as {
      readonly mesures: readonly RawMeasure[];
    };
    const { bench, commit } = await loadTrustBench(data);
    const site = await buildLibreSite({ ...input, extras: { trustBench: { bench, commit } } });
    const page = String(site.files.get("fabrique/index.html"));
    expect(page).not.toContain("Aucune mesure");
    expect(source.mesures.length).toBeGreaterThan(0);
    const rows = [...page.matchAll(/<tr><th scope="row"><code>([^<]+)<\/code><\/th>(.*?)<\/tr>/g)];
    expect(rows).toHaveLength(source.mesures.reduce((sum, item) => sum + item.couches.length, 0));
    let row = 0;
    for (const measure of source.mesures) {
      expect(page).toContain(`<code>${measure.revision}</code>`);
      expect(page).toContain(`<time datetime="${measure.date}">`);
      expect(page).toContain(
        `${measure.corpus.defauts} défauts semés, ${measure.corpus.sains} cas sains`,
      );
      expect(measure.limites.length).toBeGreaterThan(0);
      for (const limit of measure.limites) expect(page).toContain(`<li>${escapeHtml(limit)}</li>`);
      for (const layer of measure.couches) {
        const [, name, cells] = rows[row] ?? [];
        row += 1;
        expect(name).toBe(layer.couche);
        const [caught, contribution, falsePositives, unreadable] = [
          ...(cells ?? "").matchAll(/<td[^>]*>(.*?)<\/td>/g),
        ].map((cell) => cell[1]);
        expect([name, numbers(caught)]).toEqual([
          name,
          [layer.defauts_attrapes, layer.defauts_soumis],
        ]);
        expect([name, numbers(falsePositives)]).toEqual([
          name,
          [layer.faux_positifs, layer.sains_soumis],
        ]);
        expect([name, numbers(unreadable)]).toEqual([name, [layer.illisibles]]);
        if (layer.derivee_de === null) {
          expect([name, numbers(contribution)]).toEqual([
            name,
            [layer.apport_au_dela_du_moins_cher ?? -1],
          ]);
        } else {
          expect(layer.apport_au_dela_du_moins_cher).toBeNull();
          expect([name, numbers(contribution)]).toEqual([name, []]);
          expect(contribution).toContain("non applicable");
        }
      }
    }
    expect(page).toContain(`/blob/${commit}/${TRUST_BENCH_PATH}`);
    expect(page).toContain(`/blob/${commit}/${TRUST_BENCH_REPORT_PATH}`);
  });

  // Review of #18, findings 1 to 3. What the page says around the table is read from the data, or
  // says nothing the data does not carry. The expectations come from the file, not from the parser.
  test("the page says of the measure only what the pinned copy carries", async () => {
    const data = join(import.meta.dir, "../data");
    const source = JSON.parse(await readFile(join(data, TRUST_BENCH_COPY), "utf8")) as {
      readonly mesures: readonly RawMeasure[];
    };
    const { bench, commit } = await loadTrustBench(data);
    const site = await buildLibreSite({ ...input, extras: { trustBench: { bench, commit } } });
    const page = String(site.files.get("fabrique/index.html"));
    const section = page.match(/<section[^>]*id="mesure"[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(section).toContain("<table");
    let passes = 0;
    let flips = 0;
    let models = 0;
    for (const measure of source.mesures) {
      // Finding 2: nine layers, two of them derived, two models; the lead listed six and one.
      const derived = measure.couches.filter((layer) => layer.derivee_de !== null).length;
      expect(derived).toBeLessThan(measure.couches.length);
      expect(section).toContain(`<dt>Couches</dt><dd>${measure.couches.length}, `);
      if (derived > 0) expect(section).toMatch(new RegExp(` et ${derived} dérivées? des verdicts`));
      expect(section).toContain(`<dt>Modèles consignés</dt><dd>${measure.modeles.length} : `);
      for (const model of measure.modeles) {
        models += 1;
        expect(section).toContain(`${escapeHtml(model.nom)} (${escapeHtml(model.quantification)})`);
      }
      // Finding 1: a second pass in the data is on the page, with each of its flips.
      const pass = measure.second_passage;
      passes += 1;
      expect(section).toContain(`« ${escapeHtml(pass.condition)} »`);
      expect(section).toContain(`« ${escapeHtml(pass.statut)} »`);
      expect(section).toContain(`« ${escapeHtml(measure.reference.condition)} »`);
      expect(section).toContain(
        `Lignes comparées à la référence : ${pass.lignes_comparees}. États qui diffèrent : ${pass.bascules.length}.`,
      );
      for (const flip of pass.bascules) {
        flips += 1;
        expect(section).toContain(
          `<li><code>${escapeHtml(flip.cas)}</code> (${
            measure.cas.find((item) => item.id === flip.cas)?.attendu ? "défaut semé" : "cas sain"
          }), couche <code>${escapeHtml(flip.couche)}</code> : `,
        );
      }
      // Finding 3: the measure is of one repository, named in the section.
      expect(section).toContain(`sur ${escapeHtml(measure.depot)}</h3>`);
    }
    // A loop that compared nothing would prove nothing: the copy holds a measure, hence a pass.
    expect(passes).toBe(source.mesures.length);
    expect(passes).toBeGreaterThan(0);
    console.log(
      `trust bench copy against /fabrique/: ${passes} second pass(es), ${flips} flip(s), ${models} model(s) compared`,
    );
    expect(section).not.toContain("faite une fois");
    expect(section).not.toContain("modèle local");
    expect(section).not.toContain("lancée séparément");
    expect(section).not.toContain("aucun pipeline");
    // Finding 3: title and description name one brick, not the factory as a whole.
    expect(section).toContain("Sur une brique, quelle vérification attrape quoi.");
    const description = page.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    expect(description).toContain("une mesure de vérifications faite sur une brique");
    expect(description).not.toContain("ses vérifications");
  });

  test("without the measure the page says none was supplied, and shows no table", () => {
    const page = String(built.files.get("fabrique/index.html"));
    expect(page).toContain("Aucune mesure n'est fournie à cette construction.");
    expect(page).not.toContain("<table");
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
