/**
 * Page weight budget (NFR, S6.5): what a visitor downloads to read one page, counted from the
 * build output itself: the document, the stylesheets it links and the fonts those load. Images
 * are excluded by decision (the site carries none). Pure: fed the output map, never the disk.
 */

export const PAGE_BUDGET_BYTES = 150 * 1024;

export type OutputFiles = ReadonlyMap<string, string | Uint8Array>;

export interface PageWeight {
  readonly page: string;
  readonly bytes: number;
}

export interface BudgetReport {
  readonly examined: number;
  readonly heaviest: PageWeight;
  readonly violations: readonly string[];
}

const encoder = new TextEncoder();

function size(content: string | Uint8Array): number {
  return typeof content === "string" ? encoder.encode(content).length : content.length;
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

export function pageWeights(files: OutputFiles): PageWeight[] {
  const pages = [...files.keys()].filter((path) => path.endsWith(".html")).sort();
  if (pages.length === 0) throw new Error("budget.no_pages");
  return pages.map((page) => {
    const html = read(files, page);
    const text = typeof html === "string" ? html : new TextDecoder().decode(html);
    const assets = new Set<string>();
    for (const href of localTargets(text, /href="\/(assets\/[^"]+\.css)"/g)) {
      assets.add(href);
      const css = read(files, href);
      const cssText = typeof css === "string" ? css : new TextDecoder().decode(css);
      for (const url of localTargets(cssText, /url\(\s*["']?\/?(assets\/[^)"']+)["']?\s*\)/g))
        assets.add(url);
    }
    let bytes = size(html);
    for (const asset of assets) bytes += size(read(files, asset));
    return { page, bytes };
  });
}

export function checkBudget(files: OutputFiles): BudgetReport {
  const weights = pageWeights(files);
  const heaviest = weights.reduce((a, b) => (b.bytes > a.bytes ? b : a));
  const violations = weights
    .filter((weight) => weight.bytes > PAGE_BUDGET_BYTES)
    .map((weight) => `budget.page_over:${weight.page}:${weight.bytes}`);
  return { examined: weights.length, heaviest, violations };
}
