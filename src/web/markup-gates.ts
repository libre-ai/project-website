/**
 * Pure gates on markup, read after assembly rather than at construction. The builder in `html.ts`
 * only sees what goes through it; pages and the waitlist server also write attributes and buttons
 * as text templates. These gates read the result, so both paths are covered:
 * - checkUrlSchemes: every URL attribute of an assembled page carries an allow-listed scheme or
 *   none at all. It reports and never rewrites: the site fails closed;
 * - checkButtonTypes: every button declares its type, as markup or through the DOM API, so none
 *   silently submits the form around it.
 * Each returns what it examined, so a pass is never compatible with having looked at nothing.
 */

/** Adding a scheme is one line of data here, together with its test case. */
export const ALLOWED_URL_SCHEMES: ReadonlySet<string> = new Set(["https"]);

const URL_ATTRIBUTES = ["href", "src", "action", "formaction"] as const;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Scheme of a URL, lower-cased, or null when it carries none (relative URL, fragment, empty).
 * Browsers drop tabs and newlines inside a URL and trim leading spaces and controls, so the scheme
 * is read on a copy without any character at or below U+0020.
 */
export function urlScheme(value: string): string | null {
  const compact = [...value].filter((char) => char > " ").join("");
  return SCHEME.exec(compact)?.[1]?.toLowerCase() ?? null;
}

// Before the first `/`, `?` or `#` a URL holds a scheme or a first path segment, and a scheme
// never needs a character reference. An `&` there, whether it opens one of the five references
// `escapeHtml` writes or any other, means the scheme cannot be read as a browser would read it.
// The `#` of a numeric reference ends the head right after its `&`, so no decoding is needed.
const ENCODED_HEAD = /^[^/?#]*&/;

/** Line of an offset, counted from 1; offsets must be asked in increasing order. */
function lineCounter(text: string): (offset: number) => number {
  let line = 1;
  let cursor = 0;
  return (offset) => {
    for (; cursor < offset; cursor += 1) if (text[cursor] === "\n") line += 1;
    return line;
  };
}

const URL_ATTRIBUTE = new RegExp(
  `\\s(${URL_ATTRIBUTES.join("|")})\\s*=\\s*(?:"([^"]*)"|'[^']*'|[^\\s>]*)`,
  "gi",
);

/**
 * Same input shape as `checkInternalLinks`: only `.html` entries are read. The URL itself is never
 * copied into a refusal, since it may be hostile; file, line and scheme are enough to find it.
 */
export function checkUrlSchemes(files: ReadonlyMap<string, string | Uint8Array>): {
  readonly examined: number;
  readonly refused: readonly string[];
} {
  const refused: string[] = [];
  let examined = 0;
  for (const [file, content] of files) {
    if (!file.endsWith(".html")) continue;
    const html = typeof content === "string" ? content : new TextDecoder().decode(content);
    const lineOf = lineCounter(html);
    for (const match of html.matchAll(URL_ATTRIBUTE)) {
      examined += 1;
      const where = `${file}:${lineOf(match.index + 1)}`;
      const quoted = match[2];
      if (quoted === undefined) {
        refused.push(`url.attribute_unquoted:${where}:${(match[1] ?? "").toLowerCase()}`);
        continue;
      }
      if (ENCODED_HEAD.test(quoted)) {
        refused.push(`url.scheme_encoded:${where}`);
        continue;
      }
      const scheme = urlScheme(quoted);
      if (scheme !== null && !ALLOWED_URL_SCHEMES.has(scheme))
        refused.push(`url.scheme_refused:${where}:${scheme}`);
    }
  }
  return { examined, refused };
}

// The tag name is kept out of the patterns' source text: this file is itself among the sources
// the gate reads, and a literal opening tag here would be counted as a button.
const BUTTON = "button";
const BUTTON_TAG = new RegExp(`<${BUTTON}\\b[^>]*>`, "gi");
const TYPE_ATTRIBUTE = /\stype\s*=/i;
const BUTTON_CREATION = new RegExp(
  `(?:([A-Za-z_$][\\w$]*)\\s*=\\s*)?[\\w$.]*createElement\\(\\s*["']${BUTTON}["']\\s*\\)`,
  "g",
);
const TYPE_PROOF_WINDOW = 3;

/** True when a line sets the type of that very variable, by property or by `setAttribute`. */
function setsType(line: string, variable: string): boolean {
  const name = variable.replaceAll("$", "\\$");
  return new RegExp(
    `(?<![\\w$.])${name}\\.(?:type\\s*=(?!=)|setAttribute\\(\\s*["']type["']\\s*,)`,
  ).test(line);
}

/**
 * Counts two forms in named texts (assembled pages and sources): the opening tag of a button, and
 * its creation through the DOM API. A tag needs a `type` attribute; a creation needs its type set
 * on the same variable within the three following lines. A creation that is not assigned to a
 * variable cannot be followed, and is reported as missing.
 */
export function checkButtonTypes(sources: ReadonlyMap<string, string>): {
  readonly files: number;
  readonly buttons: number;
  readonly markup: number;
  readonly createElement: number;
  readonly missing: readonly string[];
} {
  const missing: string[] = [];
  let markup = 0;
  let createElement = 0;
  for (const [file, text] of sources) {
    const lineOf = lineCounter(text);
    for (const tag of text.matchAll(BUTTON_TAG)) {
      markup += 1;
      if (!TYPE_ATTRIBUTE.test(tag[0])) {
        missing.push(`button.type_missing:${file}:${lineOf(tag.index)}`);
      }
    }
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      for (const creation of line.matchAll(BUTTON_CREATION)) {
        createElement += 1;
        const variable = creation[1];
        const following = lines.slice(index + 1, index + 1 + TYPE_PROOF_WINDOW);
        if (variable === undefined || !following.some((next) => setsType(next, variable))) {
          missing.push(`button.type_missing:${file}:${index + 1}`);
        }
      }
    });
  }
  return { files: sources.size, buttons: markup + createElement, markup, createElement, missing };
}
