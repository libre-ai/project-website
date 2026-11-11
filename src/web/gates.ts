/**
 * Gates on the generated pages of the Libre IA site (plan, Task 9). Each returns what it examined,
 * so a pass is never compatible with having looked at nothing.
 * - findInlineStyles: the CSP keeps `style-src 'self'` (ADR 0005);
 * - checkCopy: nothing presented as available, no count and no progress (ADR 0007 §2-3);
 * - checkInternalLinks: every local link and asset reference resolves to a written file.
 */

export function findInlineStyles(html: string): readonly string[] {
  return [...html.matchAll(/\sstyle\s*=\s*"|<style\b/gi)].map((match) => match[0]);
}

// Wording that presents an application as usable today, and counts the site must not show.
const FORBIDDEN_COPY: readonly (readonly [string, RegExp])[] = [
  ["availability", /\bdisponibles?\b/i],
  ["download", /\btélécharge[rz]?\b|\btéléchargez\b|\btéléchargement\b/i],
  ["trial", /\bessaye[rz]? maintenant\b/i],
  ["open-beta", /\bbêta ouverte\b/i],
  ["count", /\b\d+\s*(?:applications?|dépôts?|produits?|briques?)\b/i],
  ["progress", /\b\d+\s*%/],
];

/** Visible text of a page: markup removed, entities left as written. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

export function checkCopy(pages: readonly { readonly page: string; readonly html: string }[]): {
  readonly examined: number;
  readonly violations: readonly string[];
} {
  const violations: string[] = [];
  for (const { page, html } of pages) {
    const text = visibleText(html);
    for (const [rule, pattern] of FORBIDDEN_COPY) {
      const match = pattern.exec(text);
      if (match !== null) violations.push(`copy.${rule}:${page}:${match[0]}`);
    }
  }
  return { examined: pages.length, violations };
}

function targetFile(href: string): string {
  const path = href.split(/[?#]/)[0] ?? "";
  const relative = path.replace(/^\//, "");
  return relative === "" || relative.endsWith("/") ? `${relative}index.html` : relative;
}

export function checkInternalLinks(files: ReadonlyMap<string, string | Uint8Array>): {
  readonly examined: number;
  readonly broken: readonly string[];
} {
  const broken: string[] = [];
  let examined = 0;
  for (const [page, content] of files) {
    if (!page.endsWith(".html")) continue;
    const html = typeof content === "string" ? content : new TextDecoder().decode(content);
    for (const match of html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) {
      const href = match[1] ?? "";
      if (href.startsWith("//")) continue;
      examined += 1;
      const target = targetFile(href);
      if (!files.has(target) && !files.has(`${target}/index.html`))
        broken.push(`${page} -> ${href}`);
    }
  }
  return { examined, broken };
}
