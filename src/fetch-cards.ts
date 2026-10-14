/**
 * Card source rules (G2): the pinned commits and the API path of each card. Pure functions,
 * so the rules are tested without any network. The fetch itself lives in fetch-cards-cli.ts.
 */

export interface CardSource {
  readonly repository: string;
  // Commit the card was read at.
  readonly sha: string;
  // SHA-256 of the file as read at that commit; the snapshot gate checks the committed copy against it.
  readonly sha256: string;
}

export const OWNER = "libre-ai";
export const CARD_PATH = "project.v1.yaml";
const SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function parseCardSources(value: unknown): readonly CardSource[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("card_sources.empty");
  return value.map((entry, index) => {
    const item = entry as Partial<CardSource>;
    if (typeof item.repository !== "string" || !/^[a-z0-9.-]+$/.test(item.repository)) {
      throw new Error(`card_sources.repository_invalid:${index}`);
    }
    if (typeof item.sha !== "string" || !SHA.test(item.sha)) {
      throw new Error(`card_sources.sha_invalid:${item.repository}`);
    }
    if (typeof item.sha256 !== "string" || !SHA256.test(item.sha256)) {
      throw new Error(`card_sources.sha256_invalid:${item.repository}`);
    }
    return { repository: item.repository, sha: item.sha, sha256: item.sha256 };
  });
}

// The GitHub contents API at a pinned commit, never at a branch name.
export function cardUrl(source: CardSource): string {
  return `repos/${OWNER}/${source.repository}/contents/${CARD_PATH}?ref=${source.sha}`;
}
