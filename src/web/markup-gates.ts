/**
 * Pure gates on markup, read after assembly rather than at construction. The builder in `html.ts`
 * only sees what goes through it; pages and the waitlist server also write attributes and buttons
 * as text templates. These gates read the result, so both paths are covered:
 * - checkUrlSchemes: every URL attribute of an assembled page carries an allow-listed scheme or
 *   none at all. It reports and never rewrites: the site fails closed;
 * - checkButtonTypes: every button declares its type, as markup or through the DOM API, so none
 *   silently submits the form around it.
 * Each returns what it examined, so a pass is never compatible with having looked at nothing.
 * Both read attributes by splitting each tag as the HTML tokenizer does, never by searching the
 * raw text: a `type=` or `href=` inside another attribute's value is not an attribute, and an
 * attribute glued to a `/` or a closing quote is one. A tag the text ends inside is refused
 * (`url.markup_unreadable`) or counted as missing its type, never passed.
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

/** Line of an offset, counted from 1, in any order. */
function lineCounter(text: string): (offset: number) => number {
  const breaks: number[] = [];
  for (let index = text.indexOf("\n"); index >= 0; index = text.indexOf("\n", index + 1)) {
    breaks.push(index);
  }
  return (offset) => {
    let low = 0;
    let high = breaks.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((breaks[middle] ?? 0) < offset) low = middle + 1;
      else high = middle;
    }
    return low + 1;
  };
}

interface TagAttribute {
  /** Lower-cased, as the browser stores it. */
  readonly name: string;
  readonly offset: number;
  readonly value: string;
  /** The quote around the value, or null for an unquoted or missing value. */
  readonly quote: '"' | "'" | null;
}

interface Tag {
  readonly name: string;
  readonly attributes: readonly TagAttribute[];
  /** False when the text ends inside the tag: a browser drops it, and a gate cannot read it. */
  readonly complete: boolean;
}

const BLANKS = new Set(["\t", "\n", "\f", "\r", " "]);
const TAG_OPENING = /<[A-Za-z]/g;

/**
 * Splits the start tag at `start` (a `<` followed by an ASCII letter) into attributes, following
 * the tokenizer states of the HTML standard: attributes are separated by blanks or `/`, and also
 * start right after a closing quote; a value is double-quoted, single-quoted, unquoted or missing.
 * A tag the text ends inside is returned incomplete, so that its reader refuses it.
 */
function readTag(text: string, start: number): Tag {
  const at = (index: number): string => text[index] ?? "";
  const isBlank = (index: number): boolean => BLANKS.has(at(index));
  const end = text.length;
  let index = start + 1;
  while (index < end && !isBlank(index) && at(index) !== "/" && at(index) !== ">") index += 1;
  const name = text.slice(start + 1, index).toLowerCase();
  const attributes: TagAttribute[] = [];
  const unread: Tag = { name, attributes, complete: false };
  for (;;) {
    while (index < end && (isBlank(index) || at(index) === "/")) index += 1;
    if (index >= end) return unread;
    if (at(index) === ">") return { name, attributes, complete: true };
    const offset = index;
    // The first character belongs to the name even when it is `=`, as in the standard.
    index += 1;
    while (index < end && !isBlank(index) && !["/", ">", "="].includes(at(index))) index += 1;
    const attribute = text.slice(offset, index).toLowerCase();
    while (index < end && isBlank(index)) index += 1;
    if (index >= end) return unread;
    if (at(index) !== "=") {
      attributes.push({ name: attribute, offset, value: "", quote: null });
      continue;
    }
    index += 1;
    while (index < end && isBlank(index)) index += 1;
    if (index >= end) return unread;
    const quote = at(index);
    if (quote === '"' || quote === "'") {
      const closing = text.indexOf(quote, index + 1);
      if (closing < 0) return unread;
      attributes.push({ name: attribute, offset, value: text.slice(index + 1, closing), quote });
      index = closing + 1;
      continue;
    }
    const valueStart = index;
    while (index < end && !isBlank(index) && at(index) !== ">") index += 1;
    attributes.push({ name: attribute, offset, value: text.slice(valueStart, index), quote: null });
  }
}

/**
 * Every start tag of a text, with its offset. A `<` followed by a letter is read wherever it
 * stands, inside a value, a comment or a script included: reading a tag the browser would not
 * see can only add a refusal, while skipping one the browser does see could hide a URL.
 */
function* tagsOf(text: string): Generator<{ readonly offset: number; readonly tag: Tag }> {
  for (const opening of text.matchAll(TAG_OPENING)) {
    yield { offset: opening.index, tag: readTag(text, opening.index) };
  }
}

const URL_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set(URL_ATTRIBUTES);

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
    for (const { offset, tag } of tagsOf(html)) {
      if (!tag.complete) {
        refused.push(`url.markup_unreadable:${file}:${lineOf(offset)}`);
        continue;
      }
      for (const attribute of tag.attributes) {
        if (!URL_ATTRIBUTE_NAMES.has(attribute.name)) continue;
        examined += 1;
        const where = `${file}:${lineOf(attribute.offset)}`;
        if (attribute.quote !== '"') {
          refused.push(`url.attribute_unquoted:${where}:${attribute.name}`);
          continue;
        }
        if (ENCODED_HEAD.test(attribute.value)) {
          refused.push(`url.scheme_encoded:${where}`);
          continue;
        }
        const scheme = urlScheme(attribute.value);
        if (scheme !== null && !ALLOWED_URL_SCHEMES.has(scheme))
          refused.push(`url.scheme_refused:${where}:${scheme}`);
      }
    }
  }
  return { examined, refused };
}

// The tag name is kept out of the patterns' source text: this file is itself among the sources
// the gate reads, and a literal opening tag here would be counted as a button.
const BUTTON = "button";
// `createElement` lower-cases the tag name of an HTML document, so `"BUTTON"` makes a button too.
const ANY_CASE_BUTTON = [...BUTTON].map((char) => `[${char}${char.toUpperCase()}]`).join("");
const BUTTON_CREATION = new RegExp(
  `(?:([A-Za-z_$][\\w$]*)\\s*=\\s*)?[\\w$.]*createElement\\(\\s*["'\`]${ANY_CASE_BUTTON}["'\`]\\s*\\)`,
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
    for (const { offset, tag } of tagsOf(text)) {
      if (tag.name !== BUTTON) continue;
      markup += 1;
      // A tag that cannot be read to its end proves nothing, whatever it holds so far.
      if (!tag.complete || !tag.attributes.some((attribute) => attribute.name === "type")) {
        missing.push(`button.type_missing:${file}:${lineOf(offset)}`);
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
