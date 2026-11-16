import { describe, expect, test } from "bun:test";

import { parseTrustBench, trustBenchBody, trustBenchCounts } from "./trust-bench";

const REVISION = "b".repeat(40);
const COMMIT = "c".repeat(40);

const own = (name: string, caught: number, contribution: number): Record<string, unknown> => ({
  couche: name,
  derivee_de: null,
  defauts_soumis: 4,
  defauts_attrapes: caught,
  apport_au_dela_du_moins_cher: contribution,
  sains_soumis: 3,
  faux_positifs: 1,
  illisibles: 2,
});

const derived = (): Record<string, unknown> => ({
  ...own("croisee", 4, 0),
  derivee_de: ["tests", "relecture"],
  apport_au_dela_du_moins_cher: null,
});

function measure(change: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "2026-01-02-sketch",
    date: "2026-01-02",
    depot: "libre-ai/sketch",
    revision: REVISION,
    corpus: { fichier: "corpus/sketch.json", defauts: 4, sains: 3 },
    couches: [own("tests", 3, 3), own("relecture", 4, 1), derived()],
    limites: ["Une seule brique <mesurée>."],
    ...change,
  };
}

const document = (mesures: unknown): string =>
  JSON.stringify({ schema_version: "libre-ai.trust-bench.v1", mesures });

const parsed = (change: Record<string, unknown> = {}) =>
  parseTrustBench(document([measure(change)]));

const layerChange = (change: Record<string, unknown>): Record<string, unknown> => ({
  couches: [{ ...own("tests", 3, 3), ...change }],
});

describe("parseTrustBench (the shape the page reads)", () => {
  test("reads the measure, its layers and its limits as written", () => {
    const [first] = parsed().measures;
    expect(first?.repository).toBe("libre-ai/sketch");
    expect(first?.layers.map((layer) => layer.name)).toEqual(["tests", "relecture", "croisee"]);
    expect(first?.layers[0]).toEqual({
      name: "tests",
      derivedFrom: null,
      defectsSubmitted: 4,
      defectsCaught: 3,
      contribution: 3,
      healthySubmitted: 3,
      falsePositives: 1,
      unreadable: 2,
    });
    expect(first?.layers[2]?.contribution).toBeNull();
    expect(first?.limits).toEqual(["Une seule brique <mesurée>."]);
  });

  test("counts what it read, summed over the measures", () => {
    const bench = parseTrustBench(
      document([measure(), measure({ id: "2026-01-03-other", couches: [own("tests", 1, 1)] })]),
    );
    expect(trustBenchCounts(bench)).toEqual({ measures: 2, layers: 4, defects: 8, healthy: 6 });
  });

  test("an empty or unparsable copy is refused, never read as no measure", () => {
    expect(() => parseTrustBench("")).toThrow("trust_bench.empty");
    expect(() => parseTrustBench(" \n")).toThrow("trust_bench.empty");
    expect(() => parseTrustBench("{")).toThrow("trust_bench.unreadable");
    expect(() => parseTrustBench("[]")).toThrow("trust_bench.shape:$");
  });

  test("another schema version, or no measure, is refused", () => {
    expect(() =>
      parseTrustBench(JSON.stringify({ schema_version: "v2", mesures: [measure()] })),
    ).toThrow("trust_bench.shape:schema_version");
    expect(() => parseTrustBench(document([]))).toThrow("trust_bench.shape:mesures");
  });

  test("a measure with zero layer is refused", () => {
    expect(() => parsed({ couches: [] })).toThrow("trust_bench.shape:mesures[0].couches");
  });

  test("a measure without its limits is refused: the figures never travel without them", () => {
    expect(() => parsed({ limites: [] })).toThrow("trust_bench.shape:mesures[0].limites");
    expect(() => parsed({ limites: [" "] })).toThrow("trust_bench.shape:mesures[0].limites[0]");
  });

  test.each([
    [{ id: "Sketch" }, "mesures[0].id"],
    [{ date: "2 janvier" }, "mesures[0].date"],
    [{ depot: "elsewhere/sketch" }, "mesures[0].depot"],
    [{ revision: "main" }, "mesures[0].revision"],
    [{ corpus: null }, "mesures[0].corpus"],
    [{ corpus: { defauts: 4.5, sains: 3 } }, "mesures[0].corpus.defauts"],
    [{ corpus: { defauts: 4, sains: -1 } }, "mesures[0].corpus.sains"],
    [layerChange({ couche: "" }), "mesures[0].couches[0].couche"],
    [layerChange({ defauts_attrapes: "3" }), "mesures[0].couches[0].defauts_attrapes"],
    [layerChange({ defauts_attrapes: 5 }), "mesures[0].couches[0].defauts_attrapes"],
    [layerChange({ faux_positifs: 4 }), "mesures[0].couches[0].faux_positifs"],
    [
      layerChange({ apport_au_dela_du_moins_cher: 4 }),
      "mesures[0].couches[0].apport_au_dela_du_moins_cher",
    ],
    [layerChange({ illisibles: undefined }), "mesures[0].couches[0].illisibles"],
  ])("refuses %j, naming the field", (change, path) => {
    expect(() => parsed(change)).toThrow(`trust_bench.shape:${path}`);
  });

  test("a layer with verdicts of its own must carry a contribution, a derived one must not", () => {
    expect(() => parsed(layerChange({ apport_au_dela_du_moins_cher: null }))).toThrow(
      "trust_bench.shape:mesures[0].couches[0].apport_au_dela_du_moins_cher",
    );
    expect(() =>
      parsed({
        couches: [
          own("tests", 3, 3),
          own("relecture", 4, 1),
          { ...derived(), apport_au_dela_du_moins_cher: 0 },
        ],
      }),
    ).toThrow("trust_bench.shape:mesures[0].couches[2].apport_au_dela_du_moins_cher");
  });

  test("a derived layer names layers of the same measure, and no layer appears twice", () => {
    expect(() => parsed({ couches: [own("tests", 3, 3), derived()] })).toThrow(
      "trust_bench.shape:mesures[0].couches[1].derivee_de",
    );
    expect(() => parsed({ couches: [own("tests", 3, 3), own("tests", 3, 3)] })).toThrow(
      "trust_bench.shape:mesures[0].couches[1].couche",
    );
    expect(() => parseTrustBench(document([measure(), measure()]))).toThrow(
      "trust_bench.shape:mesures[1].id",
    );
  });
});

describe("trustBenchBody (what /fabrique/ shows of a measure)", () => {
  const html = trustBenchBody(parsed(), COMMIT);

  test("shows the repository, the revision, the date and the corpus of the measure", () => {
    expect(html).toContain(`href="https://github.com/libre-ai/sketch/tree/${REVISION}"`);
    expect(html).toContain(`<code>${REVISION}</code>`);
    expect(html).toContain('<time datetime="2026-01-02">2026-01-02</time>');
    expect(html).toContain("4 défauts semés, 3 cas sains");
  });

  test("a derived layer shows its contribution as not applicable, never as a number", () => {
    const row = html.match(/<tr><th scope="row"><code>croisee<\/code>.*?<\/tr>/)?.[0] ?? "";
    const contribution = row.match(/<td data-label="Apport[^"]*">(.*?)<\/td>/)?.[1];
    expect(contribution).toBe("non applicable (couche dérivée)");
    expect(html).toContain("<code>tests</code> et <code>relecture</code>");
  });

  test("links the report and the data at the pinned commit, and quotes the limits escaped", () => {
    expect(html).toContain(
      `https://github.com/libre-ai/project-governance/blob/${COMMIT}/distribution/index/trust-bench.v1.json`,
    );
    expect(html).toContain(
      `https://github.com/libre-ai/project-governance/blob/${COMMIT}/distribution/evidence/`,
    );
    expect(html).toContain("<li>Une seule brique &lt;mesurée&gt;.</li>");
  });

  test("gives the table a caption, column and row headers, and a focusable scroll region", () => {
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<caption id="mesure-2026-01-02-sketch">');
    expect(html.match(/<th scope="col">/g)).toHaveLength(5);
    expect(html.match(/<th scope="row">/g)).toHaveLength(3);
  });
});
