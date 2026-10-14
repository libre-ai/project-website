/**
 * Product presentation (ADR 0003, FR-04): the editorial text a product page shows in place of
 * the card's summary and current situation. It is a resource: author, AI assistance, nature and
 * review date are required. A presentation is published only once reviewed by a named human;
 * until then the page falls back to the card and the build prints how many are still drafts.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseResource, type Resource } from "./resource";

export const PRESENTATION_SUFFIX = ".presentation.yaml";
// The author a draft carries before anyone reviewed it. A reviewed presentation cannot keep it.
export const AUTHOR_PLACEHOLDER = "À renseigner par le relecteur";

export interface Presentation extends Resource {
  readonly project: string;
  readonly reviewed: boolean;
  readonly pitch: string;
  readonly capabilities: readonly string[];
  readonly audience: string;
}

function text(value: unknown, error: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(error);
  return value;
}

export function parsePresentation(value: unknown): Presentation {
  const resource = parseResource(value);
  const input = value as Record<string, unknown>;
  const project = text(input.project, "presentation.project_invalid");
  if (typeof input.reviewed !== "boolean") {
    throw new Error(`presentation.reviewed_invalid:${project}`);
  }
  // A review is a human act: it cannot leave the placeholder author in place.
  if (input.reviewed && resource.author === AUTHOR_PLACEHOLDER) {
    throw new Error(`presentation.reviewed_without_author:${project}`);
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    throw new Error(`presentation.capabilities_invalid:${project}`);
  }
  return {
    ...resource,
    project,
    reviewed: input.reviewed,
    pitch: text(input.pitch, `presentation.pitch_invalid:${project}`),
    capabilities: input.capabilities.map((entry) =>
      text(entry, `presentation.capabilities_invalid:${project}`),
    ),
    audience: text(input.audience, `presentation.audience_invalid:${project}`),
  };
}

// Fails closed: an unreadable directory or a malformed file stops the load.
export async function loadPresentations(directory: string): Promise<readonly Presentation[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    throw new Error("presentations.source_unreadable");
  }
  const presentations: Presentation[] = [];
  for (const name of names.filter((entry) => entry.endsWith(PRESENTATION_SUFFIX)).sort()) {
    const raw = await readFile(join(directory, name), "utf8");
    presentations.push(parsePresentation(Bun.YAML.parse(raw)));
  }
  return presentations;
}
