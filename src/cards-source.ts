/**
 * Card source (G2): reads `project.v1` records from a directory. The directory
 * is the only source: a missing or unreadable directory is an error, and a
 * malformed card stops the load. Nothing is skipped silently, so a zero count
 * can only mean an empty source, never a failed read.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { type ProjectCard, parseProjectCard } from "./project-card";

const CARD_SUFFIX = ".project.v1.yaml";

export interface ProjectCardSource {
  readonly read: number;
  readonly cards: readonly ProjectCard[];
}

export async function loadProjectCards(directory: string): Promise<ProjectCardSource> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    throw new Error("cards.source_unreadable");
  }
  const cardNames = names.filter((name) => name.endsWith(CARD_SUFFIX)).sort();
  const cards: ProjectCard[] = [];
  for (const name of cardNames) {
    const raw = await readFile(join(directory, name), "utf8");
    cards.push(parseProjectCard(Bun.YAML.parse(raw)));
  }
  return { read: cards.length, cards };
}
