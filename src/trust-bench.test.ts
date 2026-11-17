import { describe, expect, test } from "bun:test";

import {
  checkTrustBenchRendered,
  parseTrustBench,
  trustBenchBody,
  trustBenchCounts,
} from "./trust-bench";

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
    cas: [
      ...["D1", "D2", "D3", "D4"].map((id) => ({ id, attendu: true })),
      ...["S1", "S2", "S3"].map((id) => ({ id, attendu: false })),
    ],
    modeles: [{ couche: "relecture", nom: "Modèle <A>", quantification: "Q4" }],
    reference: { fichier: "resultats/sketch.json", condition: "au <calme>" },
    second_passage: secondPass(),
    limites: ["Une seule brique <mesurée>."],
    ...change,
  };
}

function secondPass(change: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fichier: "resultats/sketch.passage2.json",
    condition: "sous <charge>",
    statut: "publié à part",
    lignes_comparees: 7,
    verdicts: ["D1", "D2", "D3", "D4", "S1", "S2", "S3"].map((cas) => ({ cas, couche: "tests" })),
    bascules: [
      { cas: "D2", couche: "tests", reference: "rouge", second_passage: "delai" },
      { cas: "S1", couche: "tests", reference: "vert", second_passage: "rouge" },
    ],
    ...change,
  };
}

const document = (mesures: unknown): string =>
  JSON.stringify({ schema_version: "libre-ai.trust-bench.v1", mesures });

const parsed = (change: Record<string, unknown> = {}) =>
  parseTrustBench(document([measure(change)]));

const layerChange = (change: Record<string, unknown>): Record<string, unknown> => ({
  couches: [{ ...own("tests", 3, 3), ...change }],
  modeles: [],
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
      document([
        measure(),
        measure({ id: "2026-01-03-other", couches: [own("tests", 1, 1)], modeles: [] }),
      ]),
    );
    expect(trustBenchCounts(bench)).toEqual({
      measures: 2,
      layers: 4,
      defects: 8,
      healthy: 6,
      models: 1,
      flips: 4,
    });
  });

  test("reads the models, the cases and the second pass the measure carries", () => {
    const [first] = parsed().measures;
    expect(first?.models).toEqual([{ layer: "relecture", name: "Modèle <A>", quantization: "Q4" }]);
    expect(first?.referenceCondition).toBe("au <calme>");
    expect(first?.secondPass).toEqual({
      condition: "sous <charge>",
      status: "publié à part",
      linesCompared: 7,
      layers: ["tests"],
      flips: [
        { caseId: "D2", seeded: true, layer: "tests", reference: "rouge", secondPass: "delai" },
        { caseId: "S1", seeded: false, layer: "tests", reference: "vert", secondPass: "rouge" },
      ],
    });
  });

  // Review of #18, finding 5: figures that contradict the measure they belong to, and values that
  // are in no domain, were read and rendered. Each one names its field.
  test.each([
    [layerChange({ defauts_soumis: 99, defauts_attrapes: 3 }), "couches[0].defauts_soumis"],
    [layerChange({ sains_soumis: 4 }), "couches[0].sains_soumis"],
    [layerChange({ illisibles: 1e21 }), "couches[0].illisibles"],
    [layerChange({ illisibles: 8 }), "couches[0].illisibles"],
    [{ corpus: { defauts: 2 ** 53, sains: 3 } }, "corpus.defauts"],
    [{ date: "2026-99-99" }, "date"],
    [{ date: "2026-02-30" }, "date"],
    [{ depot: "libre-ai/.." }, "depot"],
    [{ depot: "libre-ai/." }, "depot"],
    [{ depot: "libre-ai/a..b" }, "depot"],
    [{ depot: "libre-ai/.sketch" }, "depot"],
    [{ depot: "libre-ai/sketch." }, "depot"],
    [{ corpus: { defauts: 5, sains: 3 } }, "corpus.defauts"],
    [{ corpus: { defauts: 4, sains: 4 } }, "corpus.sains"],
    [{ cas: [] }, "cas"],
    [{ cas: [{ id: "D1", attendu: "oui" }] }, "cas[0].attendu"],
    [
      {
        cas: [
          { id: "D1", attendu: true },
          { id: "D1", attendu: true },
        ],
      },
      "cas[1].id",
    ],
    [
      { couches: [own("tests", 3, 3), { ...derived(), derivee_de: ["tests"] }] },
      "couches[1].derivee_de",
    ],
    [{ modeles: null }, "modeles"],
    [{ modeles: [{ couche: "absente", nom: "M", quantification: "Q4" }] }, "modeles[0].couche"],
    [{ modeles: [{ couche: "tests", nom: "", quantification: "Q4" }] }, "modeles[0].nom"],
    [{ reference: { condition: " " } }, "reference.condition"],
    [{ second_passage: undefined }, "second_passage"],
    [{ second_passage: null }, "second_passage"],
    [{ second_passage: secondPass({ condition: "" }) }, "second_passage.condition"],
    [{ second_passage: secondPass({ statut: 3 }) }, "second_passage.statut"],
    [{ second_passage: secondPass({ lignes_comparees: 1.5 }) }, "second_passage.lignes_comparees"],
    // Bounded by nothing else in the measure: an integer to Number.isInteger, rendered « 1e+21 ».
    [{ second_passage: secondPass({ lignes_comparees: 1e21 }) }, "second_passage.lignes_comparees"],
    [{ second_passage: secondPass({ lignes_comparees: 1 }) }, "second_passage.bascules"],
    [{ second_passage: secondPass({ verdicts: "aucun" }) }, "second_passage.verdicts"],
    [
      { second_passage: secondPass({ verdicts: [{ cas: "D9", couche: "tests" }] }) },
      "second_passage.verdicts[0].cas",
    ],
    [
      { second_passage: secondPass({ verdicts: [{ cas: "D1", couche: "absente" }] }) },
      "second_passage.verdicts[0].couche",
    ],
    [{ second_passage: secondPass({ bascules: null }) }, "second_passage.bascules"],
    [
      {
        second_passage: secondPass({
          bascules: [{ cas: "D9", couche: "tests", reference: "vert", second_passage: "rouge" }],
        }),
      },
      "second_passage.bascules[0].cas",
    ],
    [
      {
        second_passage: secondPass({
          bascules: [{ cas: "D1", couche: "absente", reference: "vert", second_passage: "rouge" }],
        }),
      },
      "second_passage.bascules[0].couche",
    ],
    [
      {
        second_passage: secondPass({
          bascules: [{ cas: "D1", couche: "tests", reference: "<b>", second_passage: "rouge" }],
        }),
      },
      "second_passage.bascules[0].reference",
    ],
    [
      {
        second_passage: secondPass({
          bascules: [{ cas: "D1", couche: "tests", reference: "vert", second_passage: "vert" }],
        }),
      },
      "second_passage.bascules[0].second_passage",
    ],
    [
      {
        second_passage: secondPass({
          bascules: [
            { cas: "D1", couche: "tests", reference: "vert", second_passage: "rouge" },
            { cas: "D1", couche: "tests", reference: "vert", second_passage: "delai" },
          ],
        }),
      },
      "second_passage.bascules[1].cas",
    ],
  ])("refuses the inconsistent %j, naming the field", (change, path) => {
    expect(() => parsed(change)).toThrow(`trust_bench.shape:mesures[0].${path}`);
  });

  test("a layer may be given fewer cases than the corpus holds, never more", () => {
    const [first] = parsed(layerChange({ defauts_soumis: 3, sains_soumis: 2 })).measures;
    expect(first?.layers[0]?.defectsSubmitted).toBe(3);
    expect(first?.layers[0]?.healthySubmitted).toBe(2);
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

  // Review of #18, finding 1: the page said the measure was taken once while the data carried a
  // second pass and its flips. The wrong sentence would be a hand-typed count of passes.
  test("shows the second pass the data carries: conditions, status, lines, and every flip", () => {
    expect(html).not.toContain("faite une fois");
    expect(html).toContain("<h4>Second passage</h4>");
    expect(html).toContain("« sous &lt;charge&gt; »");
    expect(html).toContain("« au &lt;calme&gt; »");
    expect(html).toContain("« publié à part »");
    expect(html).toContain("Couches du second passage : <code>tests</code>.");
    expect(html).toContain("Lignes comparées à la référence : 7. États qui diffèrent : 2.");
    expect(html).toContain(
      "<li><code>D2</code> (défaut semé), couche <code>tests</code> : rouge à la référence, délai dépassé au second passage.</li>",
    );
    expect(html).toContain(
      "<li><code>S1</code> (cas sain), couche <code>tests</code> : vert à la référence, rouge au second passage.</li>",
    );
  });

  test("a second pass without a flip says so, and one killed by a signal names the signal", () => {
    const none = trustBenchBody(parsed({ second_passage: secondPass({ bascules: [] }) }), COMMIT);
    expect(none).toContain("Lignes comparées à la référence : 7. États qui diffèrent : 0.");
    expect(none).not.toContain("bascules-mesure");
    const killed = trustBenchBody(
      parsed({
        second_passage: secondPass({
          verdicts: [],
          bascules: [
            { cas: "D1", couche: "tests", reference: "vert", second_passage: "signal SIGKILL" },
          ],
        }),
      }),
      COMMIT,
    );
    expect(killed).toContain("vert à la référence, interrompu par le signal SIGKILL au second");
    expect(killed).not.toContain("Couches du second passage");
  });

  // Finding 2: the count of layers and the models were typed by hand in the lead of the section.
  test("says how many layers the measure has, own and derived, and names its models", () => {
    expect(html).toContain(
      "<dt>Couches</dt><dd>3, dont 2 avec un verdict propre et 1 dérivée des verdicts d'autres couches</dd>",
    );
    expect(html).toContain(
      "<dt>Modèles consignés</dt><dd>1 : Modèle &lt;A&gt; (Q4), couche <code>relecture</code></dd>",
    );
    const plain = trustBenchBody(parsed(layerChange({})), COMMIT);
    expect(plain).toContain("<dt>Couches</dt><dd>1, avec un verdict propre</dd>");
    expect(plain).toContain("<dt>Modèles consignés</dt><dd>aucun</dd>");
  });

  // Finding 4: a mutant that stopped escaping the layer names left every test green.
  test("escapes a layer name wherever it is written: row, derived note, model, second pass", () => {
    const hostile = '<img src=x onerror="a">&';
    const escaped = "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;";
    const body = trustBenchBody(
      parsed({
        couches: [
          own(hostile, 3, 3),
          own("relecture", 4, 1),
          { ...derived(), derivee_de: [hostile, "relecture"] },
        ],
        modeles: [{ couche: hostile, nom: "M", quantification: '"Q<4>' }],
        second_passage: secondPass({
          verdicts: [{ cas: "D1", couche: hostile }],
          bascules: [{ cas: "D1", couche: hostile, reference: "vert", second_passage: "rouge" }],
        }),
      }),
      COMMIT,
    );
    expect(body).not.toContain("<img");
    expect(body).not.toContain('onerror="');
    expect(body).not.toContain('"Q<4>');
    expect(body.split(`<code>${escaped}</code>`)).toHaveLength(6);
    expect(body).toContain(`<tr><th scope="row"><code>${escaped}</code></th>`);
    expect(body).toContain(`<code>${escaped}</code> et <code>relecture</code>`);
    expect(body).toContain(`(&quot;Q&lt;4&gt;), couche <code>${escaped}</code>`);
    expect(body).toContain(`Couches du second passage : <code>${escaped}</code>.`);
    expect(body).toContain(`couche <code>${escaped}</code> : vert à la référence`);
  });

  // Finding 6: « 0 sur 0 » read like a layer measured without a false alert.
  test("a layer given no healthy case, or no defect, is shown as not measured, never 0 sur 0", () => {
    const cell = (body: string, label: string): string | undefined =>
      body.match(new RegExp(`<td data-label="${label}[^"]*">(.*?)</td>`))?.[1];
    const noHealthy = trustBenchBody(
      parsed(layerChange({ sains_soumis: 0, faux_positifs: 0, illisibles: 0 })),
      COMMIT,
    );
    expect(noHealthy).not.toContain("0 sur 0");
    expect(cell(noHealthy, "Fausses alertes")).toBe("non mesuré (aucun cas sain soumis)");
    expect(cell(noHealthy, "Défauts attrapés")).toBe("3 sur 4");
    const noDefect = trustBenchBody(
      parsed(
        layerChange({ defauts_soumis: 0, defauts_attrapes: 0, apport_au_dela_du_moins_cher: 0 }),
      ),
      COMMIT,
    );
    expect(noDefect).not.toContain("0 sur 0");
    expect(cell(noDefect, "Défauts attrapés")).toBe("non mesuré (aucun défaut soumis)");
    expect(cell(noDefect, "Apport")).toBe("non mesuré (aucun défaut soumis)");
    expect(cell(noDefect, "Fausses alertes")).toBe("1 sur 3");
  });

  test("gives the table a caption, column and row headers, and a focusable scroll region", () => {
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<caption id="mesure-2026-01-02-sketch">');
    expect(html.match(/<th scope="col">/g)).toHaveLength(5);
    expect(html.match(/<th scope="row">/g)).toHaveLength(3);
  });
});

// Review of #18, finding 7: buildLibreSite renders a notice when it is given no measure, and the
// build was green on it. The real build now counts what the written page shows.
describe("checkTrustBenchRendered (the written page shows what the build read)", () => {
  const bench = parsed();
  const counts = trustBenchCounts(bench);
  const page = `<main>${trustBenchBody(bench, COMMIT)}</main>`;

  test("passes on the rendered measure and says how many rows it counted", () => {
    expect(checkTrustBenchRendered(page, counts)).toEqual({ examined: 3, violations: [] });
  });

  test("refuses the notice shown when no measure is supplied, and a page that is not there", () => {
    const notice = "<main><p>Aucune mesure n'est fournie à cette construction.</p></main>";
    expect(checkTrustBenchRendered(notice, counts).violations).toEqual([
      "trust_bench.rendered_measures:0/1",
      "trust_bench.rendered_layers:0/3",
    ]);
    expect(checkTrustBenchRendered(undefined, counts)).toEqual({
      examined: 0,
      violations: ["trust_bench.page_missing"],
    });
  });

  test("refuses a page that shows fewer layers than were read", () => {
    const short = page.replace(/<tr><th scope="row"><code>croisee<\/code>.*?<\/tr>/, "");
    expect(checkTrustBenchRendered(short, counts).violations).toEqual([
      "trust_bench.rendered_layers:2/3",
    ]);
  });
});
