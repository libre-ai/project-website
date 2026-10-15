/**
 * DIAG-1 (O9): every node of a rendered diagram exists in its text source, and every line of
 * the source is rendered. Pure: reads strings, so the test can feed it mutated input.
 */

export interface DiagramCheck {
  readonly rendered: number;
  readonly sourceLines: number;
  readonly missingFromSource: readonly string[];
  readonly unrendered: readonly string[];
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decode(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

// One entry per <text> element: nested tspans are concatenated, empty results dropped.
export function extractTexts(html: string): string[] {
  const texts: string[] = [];
  for (const match of html.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
    const inner = (match[1] ?? "").replace(/<[^>]+>/g, "");
    const value = decode(inner).replace(/\s+/g, " ").trim();
    if (value !== "") texts.push(value);
  }
  return texts;
}

export function parseSource(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

export function checkDiagram(html: string, source: string): DiagramCheck {
  const rendered = extractTexts(html);
  // A diagram with no text node would pass any comparison: it is an unreadable source.
  if (rendered.length === 0) throw new Error("diagram.no_text_nodes");
  const lines = parseSource(source);
  const known = new Set(lines);
  const shown = new Set(rendered);
  return {
    rendered: rendered.length,
    sourceLines: lines.length,
    missingFromSource: rendered.filter((text) => !known.has(text)),
    unrendered: lines.filter((line) => !shown.has(line)),
  };
}
