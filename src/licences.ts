/**
 * Licences page (S3.2, FR-15): the SPDX identifiers each repository declares in its REUSE.toml,
 * read from a versioned copy pinned like the cards. The page lists what is declared and links to
 * the file at the pinned commit; it interprets nothing and gives no legal advice.
 */
import { escapeHtml } from "./security";

export interface LicenceRow {
  readonly repository: string;
  readonly identifiers: readonly string[];
}

// One SPDX id, or an expression of ids joined by AND / OR / WITH. Anything else is not read.
const SPDX = /^[A-Za-z0-9.+-]+(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9.+-]+)*$/;

export function parseLicences(repository: string, text: string): LicenceRow {
  const error = `licences.unreadable:${repository}`;
  let parsed: unknown;
  try {
    parsed = Bun.TOML.parse(text);
  } catch {
    throw new Error(error);
  }
  const annotations = (parsed as { annotations?: unknown }).annotations;
  if (!Array.isArray(annotations)) throw new Error(error);
  const identifiers: string[] = [];
  for (const entry of annotations) {
    const value = (entry as Record<string, unknown> | null)?.["SPDX-License-Identifier"];
    if (value === undefined) continue;
    if (typeof value !== "string" || !SPDX.test(value)) throw new Error(error);
    if (!identifiers.includes(value)) identifiers.push(value);
  }
  // A repository without any declared licence is unreadable, never "no licence to show".
  if (identifiers.length === 0) throw new Error(error);
  return { repository, identifiers };
}

export function licencesBody(
  rows: readonly LicenceRow[],
  commits: ReadonlyMap<string, string>,
): string {
  const lines = rows.map((row) => {
    const commit = commits.get(row.repository);
    if (commit === undefined) throw new Error(`licences.pin_missing:${row.repository}`);
    const file = `https://github.com/libre-ai/${escapeHtml(row.repository)}/blob/${escapeHtml(commit)}/REUSE.toml`;
    return `<tr><td data-label="Dépôt">${escapeHtml(row.repository)}</td><td data-label="Licences déclarées">${row.identifiers.map((id) => `<span class="nowrap">${escapeHtml(id)}</span>`).join(", ")}</td><td data-label="Source"><a href="${file}" rel="noopener noreferrer">REUSE.toml</a></td></tr>`;
  });
  return `<h1>Licences</h1><p>Identifiants SPDX déclarés par chaque dépôt dans son fichier REUSE.toml, lus à la révision épinglée. Cette liste reproduit ce qui est déclaré ; elle ne vaut pas conseil juridique.</p><table><thead><tr><th>Dépôt</th><th>Licences déclarées</th><th>Source</th></tr></thead><tbody>${lines.join("")}</tbody></table>`;
}
