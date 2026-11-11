/**
 * Citation of a forge brick (FR-12): author of record, verification day and the brick's page at
 * the canonical origin. It carries no state (ADR 0003, kept by ADR 0007).
 */
import { brickPath, SITE_ORIGIN } from "./origin";
import type { ProjectCard } from "./project-card";

// The author of record is the organisation that maintains the corpus: the card schema names no
// individual author, and this site does not invent one.
const AUTHOR = "Libre AI";

export function citationFor(card: ProjectCard): string {
  return `${AUTHOR}. « ${card.project} ». Vérifié le ${card.lastVerifiedOn}. ${SITE_ORIGIN}${brickPath(card.project)}`;
}
