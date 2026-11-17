/**
 * Trust bench measure on /fabrique/: what each verification layer caught of a corpus of seeded
 * defects, and what it reported wrongly on healthy cases. The figures are read from a versioned
 * copy of the authority's `distribution/index/trust-bench.v1.json`, pinned like the cards
 * (trust-bench-snapshot.ts); none is typed here. Pure: the shape the page reads, and its rendering.
 * A measure never travels without its limits, and a derived layer never shows a contribution.
 */
import { escapeHtml } from "./security";

export const TRUST_BENCH_REPOSITORY = "project-governance";
export const TRUST_BENCH_PATH = "distribution/index/trust-bench.v1.json";
// The readable report of the measure, linked at the pinned commit. The data does not name it:
// check that it still exists there when the pin moves (docs/build.md).
export const TRUST_BENCH_REPORT_PATH =
  "distribution/evidence/2026-11-16-trust-bench-first-measure.md";
// Under src/data: the pin, and the copy it covers.
export const TRUST_BENCH_PINS = "trust-bench-source.json";
export const TRUST_BENCH_COPY = "trust-bench/trust-bench.v1.json";

const SCHEMA_VERSION = "libre-ai.trust-bench.v1";

export interface TrustBenchLayer {
  readonly name: string;
  /** Null for a layer with verdicts of its own; the layers a derived one combines. */
  readonly derivedFrom: readonly string[] | null;
  readonly defectsSubmitted: number;
  readonly defectsCaught: number;
  /** Defects no cheaper layer caught. Null, not applicable, for a derived layer: never zero. */
  readonly contribution: number | null;
  readonly healthySubmitted: number;
  readonly falsePositives: number;
  readonly unreadable: number;
}

export interface TrustBenchModel {
  /** The layer of the measure this model is recorded for. */
  readonly layer: string;
  readonly name: string;
  readonly quantization: string;
}

/** A run whose state in the second pass differs from the reference. */
export interface TrustBenchFlip {
  readonly caseId: string;
  /** True for a seeded defect, false for a healthy case. */
  readonly seeded: boolean;
  readonly layer: string;
  readonly reference: string;
  readonly secondPass: string;
}

/** A pass taken under other conditions, published apart: none of it is in the layer figures. */
export interface TrustBenchSecondPass {
  readonly condition: string;
  readonly status: string;
  readonly linesCompared: number;
  /** The layers its verdicts name, in the order they first appear. */
  readonly layers: readonly string[];
  readonly flips: readonly TrustBenchFlip[];
}

export interface TrustBenchMeasure {
  readonly id: string;
  readonly date: string;
  readonly repository: string;
  readonly revision: string;
  readonly defects: number;
  readonly healthy: number;
  readonly layers: readonly TrustBenchLayer[];
  readonly models: readonly TrustBenchModel[];
  readonly referenceCondition: string;
  readonly secondPass: TrustBenchSecondPass;
  readonly limits: readonly string[];
}

export interface TrustBench {
  readonly measures: readonly TrustBenchMeasure[];
}

export interface TrustBenchCounts {
  readonly measures: number;
  readonly layers: number;
  readonly defects: number;
  readonly healthy: number;
  readonly models: number;
  readonly flips: number;
}

type Fields = Readonly<Record<string, unknown>>;

function refuse(path: string): never {
  throw new Error(`trust_bench.shape:${path}`);
}

function fields(value: unknown, path: string): Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) refuse(path);
  return value as Fields;
}

// An empty list is refused like a missing one: nothing to show is never a result.
function items(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0) refuse(path);
  return value;
}

// A list that may be empty: no model recorded, no flip. Anything that is not a list is refused.
function list(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) refuse(path);
  return value;
}

// A safe integer: 1e21 is an integer to Number.isInteger, and is rendered « 1e+21 ».
function count(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) refuse(path);
  return value;
}

function text(value: unknown, path: string, pattern: RegExp = /\S/): string {
  if (typeof value !== "string" || !pattern.test(value)) refuse(path);
  return value;
}

// A day that exists: the pattern alone accepts 2026-99-99.
function calendarDate(value: unknown, path: string): string {
  const date = text(value, path, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
  const day = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) refuse(path);
  return date;
}

// The state of one run of a launched layer, as the authority writes it.
const RUN_STATE = /^(?:vert|rouge|delai|signal [A-Za-z0-9]+)$/;

function parseLayer(value: unknown, path: string): TrustBenchLayer {
  const item = fields(value, path);
  const derivedFrom =
    item.derivee_de === null
      ? null
      : items(item.derivee_de, `${path}.derivee_de`).map((name, index) =>
          text(name, `${path}.derivee_de[${index}]`),
        );
  // A derived layer combines the verdicts of several layers: one alone is that layer itself.
  if (derivedFrom !== null && derivedFrom.length < 2) refuse(`${path}.derivee_de`);
  const defectsSubmitted = count(item.defauts_soumis, `${path}.defauts_soumis`);
  const defectsCaught = count(item.defauts_attrapes, `${path}.defauts_attrapes`);
  if (defectsCaught > defectsSubmitted) refuse(`${path}.defauts_attrapes`);
  const healthySubmitted = count(item.sains_soumis, `${path}.sains_soumis`);
  const falsePositives = count(item.faux_positifs, `${path}.faux_positifs`);
  if (falsePositives > healthySubmitted) refuse(`${path}.faux_positifs`);
  // The contract of the authority: a number for a layer with its own verdicts, null for a derived
  // one. Anything else is refused, so a null can never be rendered for the wrong reason.
  const contributionPath = `${path}.apport_au_dela_du_moins_cher`;
  let contribution: number | null = null;
  if (derivedFrom === null) {
    contribution = count(item.apport_au_dela_du_moins_cher, contributionPath);
    if (contribution > defectsCaught) refuse(contributionPath);
  } else if (item.apport_au_dela_du_moins_cher !== null) {
    refuse(contributionPath);
  }
  return {
    name: text(item.couche, `${path}.couche`),
    derivedFrom,
    defectsSubmitted,
    defectsCaught,
    contribution,
    healthySubmitted,
    falsePositives,
    unreadable: count(item.illisibles, `${path}.illisibles`),
  };
}

function parseMeasure(value: unknown, path: string): TrustBenchMeasure {
  const item = fields(value, path);
  const corpus = fields(item.corpus, `${path}.corpus`);
  const layers = items(item.couches, `${path}.couches`).map((layer, index) =>
    parseLayer(layer, `${path}.couches[${index}]`),
  );
  const names = new Set<string>();
  layers.forEach((layer, index) => {
    if (names.has(layer.name)) refuse(`${path}.couches[${index}].couche`);
    names.add(layer.name);
  });
  layers.forEach((layer, index) => {
    if (layer.derivedFrom?.some((name) => !names.has(name) || name === layer.name)) {
      refuse(`${path}.couches[${index}].derivee_de`);
    }
  });
  const defects = count(corpus.defauts, `${path}.corpus.defauts`);
  const healthy = count(corpus.sains, `${path}.corpus.sains`);
  // A layer may be given fewer cases than the corpus holds (a review has no diff to read for the
  // original revision), never more; and it cannot leave more answers unreadable than it was given.
  layers.forEach((layer, index) => {
    const layerPath = `${path}.couches[${index}]`;
    if (layer.defectsSubmitted > defects) refuse(`${layerPath}.defauts_soumis`);
    if (layer.healthySubmitted > healthy) refuse(`${layerPath}.sains_soumis`);
    if (layer.unreadable > layer.defectsSubmitted + layer.healthySubmitted) {
      refuse(`${layerPath}.illisibles`);
    }
  });
  const cases = parseCases(item.cas, `${path}.cas`);
  // The corpus counts are the counts of the cases the measure lists, or one of the two is wrong.
  const seeded = [...cases.values()].filter(Boolean).length;
  if (seeded !== defects) refuse(`${path}.corpus.defauts`);
  if (cases.size - seeded !== healthy) refuse(`${path}.corpus.sains`);
  const models = list(item.modeles, `${path}.modeles`).map((model, index) =>
    parseModel(model, `${path}.modeles[${index}]`, names),
  );
  const reference = fields(item.reference, `${path}.reference`);
  return {
    // The id becomes an HTML id, the repository and the revision a URL: each has one shape only.
    id: text(item.id, `${path}.id`, /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+$/),
    date: calendarDate(item.date, `${path}.date`),
    // Narrower than the authority's pattern, which lets « .. » through: a dot only between two
    // name segments. A repository named with a leading dot is refused, loudly, rather than linked.
    repository: text(item.depot, `${path}.depot`, /^libre-ai\/[a-z0-9-]+(?:\.[a-z0-9-]+)*$/),
    revision: text(item.revision, `${path}.revision`, /^[0-9a-f]{40}$/),
    defects,
    healthy,
    layers,
    models,
    referenceCondition: text(reference.condition, `${path}.reference.condition`),
    secondPass: parseSecondPass(item.second_passage, `${path}.second_passage`, names, cases),
    limits: items(item.limites, `${path}.limites`).map((limit, index) =>
      text(limit, `${path}.limites[${index}]`),
    ),
  };
}

/** The cases of a measure by id: true for a seeded defect, false for a healthy case. */
function parseCases(value: unknown, path: string): ReadonlyMap<string, boolean> {
  const cases = new Map<string, boolean>();
  items(value, path).forEach((entry, index) => {
    const item = fields(entry, `${path}[${index}]`);
    const id = text(item.id, `${path}[${index}].id`);
    if (cases.has(id)) refuse(`${path}[${index}].id`);
    if (typeof item.attendu !== "boolean") refuse(`${path}[${index}].attendu`);
    cases.set(id, item.attendu);
  });
  return cases;
}

function parseModel(value: unknown, path: string, layers: ReadonlySet<string>): TrustBenchModel {
  const item = fields(value, path);
  const layer = text(item.couche, `${path}.couche`);
  if (!layers.has(layer)) refuse(`${path}.couche`);
  return {
    layer,
    name: text(item.nom, `${path}.nom`),
    quantization: text(item.quantification, `${path}.quantification`),
  };
}

function parseSecondPass(
  value: unknown,
  path: string,
  layers: ReadonlySet<string>,
  cases: ReadonlyMap<string, boolean>,
): TrustBenchSecondPass {
  const item = fields(value, path);
  const linesCompared = count(item.lignes_comparees, `${path}.lignes_comparees`);
  // Every verdict and every flip names a case and a layer of this measure.
  const named = (entry: Fields, entryPath: string): { caseId: string; layer: string } => {
    const caseId = text(entry.cas, `${entryPath}.cas`);
    if (!cases.has(caseId)) refuse(`${entryPath}.cas`);
    const layer = text(entry.couche, `${entryPath}.couche`);
    if (!layers.has(layer)) refuse(`${entryPath}.couche`);
    return { caseId, layer };
  };
  const passLayers = new Set<string>();
  list(item.verdicts, `${path}.verdicts`).forEach((verdict, index) => {
    const verdictPath = `${path}.verdicts[${index}]`;
    passLayers.add(named(fields(verdict, verdictPath), verdictPath).layer);
  });
  const seen = new Set<string>();
  const flips = list(item.bascules, `${path}.bascules`).map((flip, index) => {
    const flipPath = `${path}.bascules[${index}]`;
    const entry = fields(flip, flipPath);
    const { caseId, layer } = named(entry, flipPath);
    const run = JSON.stringify([caseId, layer]);
    if (seen.has(run)) refuse(`${flipPath}.cas`);
    seen.add(run);
    const reference = text(entry.reference, `${flipPath}.reference`, RUN_STATE);
    const secondPass = text(entry.second_passage, `${flipPath}.second_passage`, RUN_STATE);
    // A flip is a difference: the same state on both sides is not one.
    if (secondPass === reference) refuse(`${flipPath}.second_passage`);
    return { caseId, seeded: cases.get(caseId) === true, layer, reference, secondPass };
  });
  if (flips.length > linesCompared) refuse(`${path}.bascules`);
  return {
    condition: text(item.condition, `${path}.condition`),
    status: text(item.statut, `${path}.statut`),
    linesCompared,
    layers: [...passLayers],
    flips,
  };
}

export function parseTrustBench(source: string): TrustBench {
  if (source.trim() === "") throw new Error("trust_bench.empty");
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("trust_bench.unreadable");
  }
  const root = fields(value, "$");
  if (root.schema_version !== SCHEMA_VERSION) refuse("schema_version");
  const measures = items(root.mesures, "mesures").map((measure, index) =>
    parseMeasure(measure, `mesures[${index}]`),
  );
  const ids = new Set<string>();
  measures.forEach((measure, index) => {
    if (ids.has(measure.id)) refuse(`mesures[${index}].id`);
    ids.add(measure.id);
  });
  return { measures };
}

export function trustBenchCounts(bench: TrustBench): TrustBenchCounts {
  const sum = (pick: (measure: TrustBenchMeasure) => number): number =>
    bench.measures.reduce((total, measure) => total + pick(measure), 0);
  return {
    measures: bench.measures.length,
    layers: sum((measure) => measure.layers.length),
    defects: sum((measure) => measure.defects),
    healthy: sum((measure) => measure.healthy),
    models: sum((measure) => measure.models.length),
    flips: sum((measure) => measure.secondPass.flips.length),
  };
}

const COLUMNS = [
  "Couche",
  "Défauts attrapés",
  "Apport au-delà des couches moins chères",
  "Fausses alertes sur cas sains",
  "Illisibles",
] as const;

const code = (value: string): string => `<code>${escapeHtml(value)}</code>`;

// A layer given no case of a kind was not measured on that kind: « 0 sur 0 » would read like a
// layer measured without a catch, or without a false alert.
const NO_DEFECT = "non mesuré (aucun défaut soumis)";
const NO_HEALTHY = "non mesuré (aucun cas sain soumis)";

function contributionCell(layer: TrustBenchLayer): string {
  if (layer.contribution === null) return "non applicable (couche dérivée)";
  return layer.defectsSubmitted === 0 ? NO_DEFECT : String(layer.contribution);
}

function layerRow(layer: TrustBenchLayer): string {
  const cells = [
    layer.defectsSubmitted === 0
      ? NO_DEFECT
      : `${layer.defectsCaught} sur ${layer.defectsSubmitted}`,
    contributionCell(layer),
    layer.healthySubmitted === 0
      ? NO_HEALTHY
      : `${layer.falsePositives} sur ${layer.healthySubmitted}`,
    String(layer.unreadable),
  ];
  return `<tr><th scope="row">${code(layer.name)}</th>${cells
    .map((cell, index) => `<td data-label="${COLUMNS[index + 1]}">${cell}</td>`)
    .join("")}</tr>`;
}

function derivedNote(layer: TrustBenchLayer): string {
  if (layer.derivedFrom === null) return "";
  return `<li>${code(layer.name)} est une couche dérivée : elle combine les verdicts de ${layer.derivedFrom
    .map(code)
    .join(
      " et ",
    )}, sans verdict propre. Son apport n'est pas une mesure : il est déclaré non applicable, jamais nul.</li>`;
}

// How many layers the measure has, and how many of them have no verdict of their own.
function layersFact(layers: readonly TrustBenchLayer[]): string {
  const derived = layers.filter((layer) => layer.derivedFrom !== null).length;
  if (derived === 0) return `${layers.length}, avec un verdict propre`;
  return `${layers.length}, dont ${layers.length - derived} avec un verdict propre et ${derived} ${
    derived === 1 ? "dérivée" : "dérivées"
  } des verdicts d'autres couches`;
}

// The models as the measure records them, each with the layer it is recorded for.
function modelsFact(models: readonly TrustBenchModel[]): string {
  if (models.length === 0) return "aucun";
  return `${models.length} : ${models
    .map(
      (model) =>
        `${escapeHtml(model.name)} (${escapeHtml(model.quantization)}), couche ${code(model.layer)}`,
    )
    .join(" ; ")}`;
}

// A run state in words. The parser accepts « vert », « rouge », « delai » and « signal NAME » only.
function runState(state: string): string {
  if (state === "delai") return "délai dépassé";
  if (state.startsWith("signal ")) {
    return `interrompu par le signal ${escapeHtml(state.slice("signal ".length))}`;
  }
  return escapeHtml(state);
}

function flipItem(flip: TrustBenchFlip): string {
  return `<li>${code(flip.caseId)} (${flip.seeded ? "défaut semé" : "cas sain"}), couche ${code(
    flip.layer,
  )} : ${runState(flip.reference)} à la référence, ${runState(flip.secondPass)} au second passage.</li>`;
}

// The second pass of the measure. Everything here is read from the data: its condition and its
// status are quoted, its flips are listed whole. The table above holds none of its verdicts.
function secondPassBody(measure: TrustBenchMeasure): string {
  const pass = measure.secondPass;
  const quote = (value: string): string => `« ${escapeHtml(value)} »`;
  return [
    "<h4>Second passage</h4>",
    `<p>La donnée porte un second passage, pris sous la condition ${quote(pass.condition)} ; la référence l'a été sous la condition ${quote(measure.referenceCondition)}. Statut que la donnée lui donne : ${quote(pass.status)}. Le tableau ci-dessus est celui de la référence : il ne contient aucun verdict du second passage.</p>`,
    pass.layers.length === 0
      ? ""
      : `<p>Couches du second passage : ${pass.layers.map(code).join(", ")}.</p>`,
    `<p>Lignes comparées à la référence : ${pass.linesCompared}. États qui diffèrent : ${pass.flips.length}.</p>`,
    pass.flips.length === 0
      ? ""
      : `<ul class="bascules-mesure">${pass.flips.map(flipItem).join("")}</ul>`,
  ].join("");
}

function measureBody(measure: TrustBenchMeasure, commit: string): string {
  const authority = `https://github.com/libre-ai/${TRUST_BENCH_REPOSITORY}/blob/${escapeHtml(commit)}`;
  const caption = `mesure-${measure.id}`;
  return [
    // The repository closes the title: a date followed by « Dépôt » would read as a count of
    // repositories to the copy gate (ADR 0007 §3).
    `<h3>Mesure du <time datetime="${measure.date}">${measure.date}</time> sur ${escapeHtml(measure.repository)}</h3>`,
    `<dl class="faits-mesure"><dt>Dépôt mesuré</dt><dd><a href="https://github.com/${measure.repository}/tree/${measure.revision}" rel="noopener noreferrer">${escapeHtml(measure.repository)}</a></dd>`,
    `<dt>Révision mesurée</dt><dd>${code(measure.revision)}</dd>`,
    `<dt>Corpus</dt><dd>${measure.defects} défauts semés, ${measure.healthy} cas sains</dd>`,
    `<dt>Couches</dt><dd>${layersFact(measure.layers)}</dd>`,
    `<dt>Modèles consignés</dt><dd>${modelsFact(measure.models)}</dd></dl>`,
    `<div class="mesure-defilement" role="region" aria-labelledby="${caption}" tabindex="0"><table><caption id="${caption}">Résultat par couche de vérification</caption>`,
    `<thead><tr>${COLUMNS.map((column) => `<th scope="col">${column}</th>`).join("")}</tr></thead>`,
    `<tbody>${measure.layers.map(layerRow).join("")}</tbody></table></div>`,
    secondPassBody(measure),
    '<ul class="notes-mesure"><li>Les couches portent le nom que leur donne la mesure.</li>',
    "<li>Apport : défauts attrapés par la couche et par aucune couche de coût inférieur. L'ordre de coût est posé à la main, ce n'est pas une mesure.</li>",
    "<li>Illisible : une réponse qui n'est ni un vert ni un rouge.</li>",
    `${measure.layers.map(derivedNote).join("")}</ul>`,
    "<h4>Ce que cette mesure ne dit pas</h4>",
    "<ul><li>Elle porte sur un seul dépôt, à une seule révision. Elle ne dit rien des autres dépôts de la forge.</li>",
    // No count of passes is typed here: the data carries them, and the section above shows them.
    "<li>Cette page recopie un enregistrement daté : elle ne le rejoue pas.</li>",
    "<li>Elle ne promet aucun résultat sur un autre défaut, un autre changement ou un autre modèle.</li></ul>",
    "<h4>Limites déclarées par la mesure</h4>",
    "<p>Reprises telles quelles de la donnée, sans tri ni résumé.</p>",
    `<ul class="limites-mesure">${measure.limits.map((limit) => `<li>${escapeHtml(limit)}</li>`).join("")}</ul>`,
    `<p><a href="${authority}/${TRUST_BENCH_REPORT_PATH}" rel="noopener noreferrer">Lire le rapport de mesure</a> · <a href="${authority}/${TRUST_BENCH_PATH}" rel="noopener noreferrer">Lire la donnée</a> (dépôt de gouvernance, au commit épinglé).</p>`,
  ].join("");
}

export function trustBenchBody(bench: TrustBench, commit: string): string {
  return bench.measures.map((measure) => measureBody(measure, commit)).join("");
}

/**
 * Gate of the real build: the written /fabrique/ page shows as many measures and as many layer
 * rows as the build read. buildLibreSite renders a notice when it is given no measure, which the
 * unit tests of other pages rely on; this check is what keeps a build from shipping that notice.
 */
export function checkTrustBenchRendered(
  page: string | undefined,
  counts: TrustBenchCounts,
): { readonly examined: number; readonly violations: readonly string[] } {
  if (page === undefined) return { examined: 0, violations: ["trust_bench.page_missing"] };
  const measures = page.split('<caption id="mesure-').length - 1;
  const layers = page.split('<tr><th scope="row"><code>').length - 1;
  const violations: string[] = [];
  if (measures !== counts.measures) {
    violations.push(`trust_bench.rendered_measures:${measures}/${counts.measures}`);
  }
  if (layers !== counts.layers) {
    violations.push(`trust_bench.rendered_layers:${layers}/${counts.layers}`);
  }
  return { examined: layers, violations };
}
