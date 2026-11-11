/**
 * Page weight budget (NFR, S6.5, plan Task 9): what a visitor downloads to read one page, counted
 * from the build output itself: the document, the stylesheets it links and the fonts those load,
 * its scripts, its icon and the sprite it references. Each file travels gzip-compressed, except
 * fonts, which are compressed already; the budget holds the transferred bytes. Images are
 * excluded by decision (the site carries none). Pure: fed the output map, never the disk.
 */

export const PAGE_BUDGET_BYTES = 120 * 1024;

/** Ceilings of the shared assets, uncompressed, independent of any page. */
export const ASSET_BUDGETS = {
  "assets/main.js": 16 * 1024,
  "assets/site.css": 48 * 1024,
  "assets/volee.svg": 80 * 1024,
} as const satisfies Readonly<Record<string, number>>;

export type OutputFiles = ReadonlyMap<string, string | Uint8Array>;

export interface PageWeight {
  readonly page: string;
  /** Raw bytes of the page and everything it loads. */
  readonly bytes: number;
  /** Bytes transferred, each file compressed as the server sends it. */
  readonly gzipBytes: number;
}

export interface BudgetReport {
  readonly examined: number;
  readonly heaviest: PageWeight;
  readonly violations: readonly string[];
}

const encoder = new TextEncoder();
const PRECOMPRESSED = /\.woff2$/;

function asBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === "string" ? encoder.encode(content) : content;
}

function transferred(path: string, content: Uint8Array): number {
  if (PRECOMPRESSED.test(path)) return content.length;
  // A copy into a plain ArrayBuffer: gzipSync refuses a view over a possibly shared buffer.
  return Bun.gzipSync(new Uint8Array(content), { level: 9 }).length;
}

// Local references only, written with a leading slash (/assets/...): that is how the site links.
function localTargets(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

function read(files: OutputFiles, path: string): string | Uint8Array {
  const content = files.get(path);
  // A reference to a file the build did not write is an unmeasurable page, never a lighter one.
  if (content === undefined) throw new Error(`budget.asset_missing:${path}`);
  return content;
}

const asText = (content: string | Uint8Array): string =>
  typeof content === "string" ? content : new TextDecoder().decode(content);

export function pageWeights(files: OutputFiles): PageWeight[] {
  const pages = [...files.keys()].filter((path) => path.endsWith(".html")).sort();
  if (pages.length === 0) throw new Error("budget.no_pages");
  return pages.map((page) => {
    const text = asText(read(files, page));
    const assets = new Set<string>();
    for (const href of localTargets(text, /href="\/(assets\/[^"]+\.css)"/g)) {
      assets.add(href);
      const cssText = asText(read(files, href));
      for (const url of localTargets(cssText, /url\(\s*["']?\/?(assets\/[^)"']+)["']?\s*\)/g))
        assets.add(url);
    }
    for (const src of localTargets(text, /src="\/(assets\/[^"]+\.js)"/g)) assets.add(src);
    // Sprite references and the icon: the file once, whatever fragment is used.
    for (const svg of localTargets(text, /href="\/(assets\/[^"#]+\.svg)(?:#[^"]*)?"/g))
      assets.add(svg);
    let bytes = asBytes(read(files, page)).length;
    let gzipBytes = transferred(page, asBytes(read(files, page)));
    for (const asset of assets) {
      const content = asBytes(read(files, asset));
      bytes += content.length;
      gzipBytes += transferred(asset, content);
    }
    return { page, bytes, gzipBytes };
  });
}

export function checkBudget(files: OutputFiles): BudgetReport {
  const weights = pageWeights(files);
  const heaviest = weights.reduce((a, b) => (b.gzipBytes > a.gzipBytes ? b : a));
  const violations = weights
    .filter((weight) => weight.gzipBytes > PAGE_BUDGET_BYTES)
    .map((weight) => `budget.page_over:${weight.page}:${weight.gzipBytes}`);
  return { examined: weights.length, heaviest, violations };
}

export function checkAssetBudgets(files: OutputFiles): {
  readonly examined: number;
  readonly violations: readonly string[];
} {
  const violations: string[] = [];
  let examined = 0;
  for (const [path, ceiling] of Object.entries(ASSET_BUDGETS)) {
    const content = files.get(path);
    if (content === undefined) {
      violations.push(`budget.asset_missing:${path}`);
      continue;
    }
    examined += 1;
    const size = asBytes(content).length;
    if (size > ceiling) violations.push(`budget.asset_over:${path}:${size}`);
  }
  return { examined, violations };
}
