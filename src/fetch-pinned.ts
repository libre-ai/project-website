/**
 * Pinned fetch rules (G2, S3.2, S3.3): the URL of a file at a pinned commit. Pure, so it is tested
 * without any network; the reads and writes live in fetch-pinned-io.ts. The build never fetches:
 * it verifies the versioned copies against their recorded digests (cards-snapshot.ts).
 */
import { OWNER, type PinnedSource } from "./fetch-cards";

// The contents API at a pinned commit. The path is a plain relative file path: it is
// interpolated into a URL, so anything that could change the request is refused.
export function pinnedUrl(source: PinnedSource, path: string): string {
  if (path === "" || path.startsWith("/") || /(^|\/)\.\.(\/|$)|[?#]/.test(path)) {
    throw new Error("pinned_fetch.path_invalid");
  }
  return `repos/${OWNER}/${source.repository}/contents/${path}?ref=${source.sha}`;
}
