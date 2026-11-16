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

export interface TrustBenchMeasure {
  readonly id: string;
  readonly date: string;
  readonly repository: string;
  readonly revision: string;
  readonly defects: number;
  readonly healthy: number;
  readonly layers: readonly TrustBenchLayer[];
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

function count(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) refuse(path);
  return value;
}

function text(value: unknown, path: string, pattern: RegExp = /\S/): string {
  if (typeof value !== "string" || !pattern.test(value)) refuse(path);
  return value;
}

function parseLayer(value: unknown, path: string): TrustBenchLayer {
  const item = fields(value, path);
  const derivedFrom =
    item.derivee_de === null
      ? null
      : items(item.derivee_de, `${path}.derivee_de`).map((name, index) =>
          text(name, `${path}.derivee_de[${index}]`),
        );
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
  return {
    // The id becomes an HTML id, the repository and the revision a URL: each has one shape only.
    id: text(item.id, `${path}.id`, /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+$/),
    date: text(item.date, `${path}.date`, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    repository: text(item.depot, `${path}.depot`, /^libre-ai\/[a-z0-9.][a-z0-9.-]*$/),
    revision: text(item.revision, `${path}.revision`, /^[0-9a-f]{40}$/),
    defects: count(corpus.defauts, `${path}.corpus.defauts`),
    healthy: count(corpus.sains, `${path}.corpus.sains`),
    layers,
    limits: items(item.limites, `${path}.limites`).map((limit, index) =>
      text(limit, `${path}.limites[${index}]`),
    ),
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

function layerRow(layer: TrustBenchLayer): string {
  const cells = [
    `${layer.defectsCaught} sur ${layer.defectsSubmitted}`,
    layer.contribution === null ? "non applicable (couche dérivée)" : String(layer.contribution),
    `${layer.falsePositives} sur ${layer.healthySubmitted}`,
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

function measureBody(measure: TrustBenchMeasure, commit: string): string {
  const authority = `https://github.com/libre-ai/${TRUST_BENCH_REPOSITORY}/blob/${escapeHtml(commit)}`;
  const caption = `mesure-${measure.id}`;
  return [
    // The repository closes the title: a date followed by « Dépôt » would read as a count of
    // repositories to the copy gate (ADR 0007 §3).
    `<h3>Mesure du <time datetime="${measure.date}">${measure.date}</time> sur ${escapeHtml(measure.repository)}</h3>`,
    `<dl class="faits-mesure"><dt>Dépôt mesuré</dt><dd><a href="https://github.com/${measure.repository}/tree/${measure.revision}" rel="noopener noreferrer">${escapeHtml(measure.repository)}</a></dd>`,
    `<dt>Révision mesurée</dt><dd>${code(measure.revision)}</dd>`,
    `<dt>Corpus</dt><dd>${measure.defects} défauts semés, ${measure.healthy} cas sains</dd></dl>`,
    `<div class="mesure-defilement" role="region" aria-labelledby="${caption}" tabindex="0"><table><caption id="${caption}">Résultat par couche de vérification</caption>`,
    `<thead><tr>${COLUMNS.map((column) => `<th scope="col">${column}</th>`).join("")}</tr></thead>`,
    `<tbody>${measure.layers.map(layerRow).join("")}</tbody></table></div>`,
    '<ul class="notes-mesure"><li>Les couches portent le nom que leur donne la mesure.</li>',
    "<li>Apport : défauts attrapés par la couche et par aucune couche de coût inférieur. L'ordre de coût est posé à la main, ce n'est pas une mesure.</li>",
    "<li>Illisible : une réponse qui n'est ni un vert ni un rouge.</li>",
    `${measure.layers.map(derivedNote).join("")}</ul>`,
    "<h4>Ce que cette mesure ne dit pas</h4>",
    "<ul><li>Elle porte sur un seul dépôt, à une seule révision. Elle ne dit rien des autres dépôts de la forge.</li>",
    "<li>Elle a été faite une fois, à la date indiquée. Le banc ne tourne dans aucun pipeline : cette page recopie un enregistrement, elle ne le rejoue pas.</li>",
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
