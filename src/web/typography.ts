/**
 * French typography of the written pages: a no-break space before `: ; ! ?` and `»`, and after
 * `«`, so a line never starts with a sign or ends on an opening guillemet. It runs once on each
 * finished page (src/web/routes.ts), after every source has been assembled: the copy of this
 * repository, the authored demo and tour markup, and the records quoted verbatim from the other
 * repositories, which cannot be edited here. Only text a reader sees changes: code, scripts,
 * styles and comments stay as written, and among attributes only the readable ones.
 */

const NBSP = "\u00a0";

/** Elements whose content is not prose, or not shown as prose. */
const VERBATIM = "script|style|pre|code|kbd|samp|textarea";

/** Elements that continue a line: a sign after them still belongs to the word before them. */
const INLINE = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "cite",
  "data",
  "dfn",
  "em",
  "i",
  "mark",
  "q",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
]);

const READABLE_ATTRIBUTES = /(\s(?:title|alt|aria-label|placeholder)=")([^"]*)(")/g;
const META_DESCRIPTION = /^<meta\s[^>]*\bname="description"/;
const META_CONTENT = /(\scontent=")([^"]*)(")/;

const TOKEN = new RegExp(
  `<!--[\\s\\S]*?-->|<(${VERBATIM})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>|<\\/?([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*>|<![^>]*>|[^<]+|<`,
  "g",
);
const BEFORE_SIGN = /(?<=\S)[ \t\r\n]+(?=[:;!?»])/g;
const AFTER_GUILLEMET = /(?<=«)[ \t\r\n]+/g;
// A number of the text stands alone: not part of a word, a version, a date, a time or a hash.
const NUMBER_START = String.raw`(?<![\p{L}\d.,:#\/\-])`;
const NUMBER_END = String.raw`(?![\p{L}\d]|[.,:\/\-]\d)`;
/** Spaces between the groups of thousands: 1 200, 1 234 567. */
const THOUSANDS = new RegExp(
  String.raw`(?<=${NUMBER_START}\d{1,3}(?:[ \t\r\n]+\d{3})*)[ \t\r\n]+(?=\d{3}${NUMBER_END})`,
  "gu",
);
/**
 * The space after a number, before its unit, sign or counted word: 480 €, 3 jours, 14 h. Not in
 * a rank (1 sur 7), where « sur » goes with the total and the line breaks before it.
 */
const AFTER_NUMBER = new RegExp(
  String.raw`(?<=${NUMBER_START}\d+(?:[.,]\d+)?)${NUMBER_END}[ \t\r\n]+(?=[\p{L}€%$£°])(?!sur[ \t\r\n]+\d)`,
  "gu",
);
/** The total of a rank: 1 sur 7. */
const RANK_TOTAL = /(?<=\d[ \t\r\n]+sur)[ \t\r\n]+(?=\d)/g;
/** The minutes of a time: 14 h 30. */
const MINUTES = /(?<=\d\u00a0h)[ \t\r\n]+(?=\d)/g;
/** The space between a numbering word and its number: étape 1, chapitre 4, ADR 0005. */
const NUMBERING =
  /(?<=(?<!\p{L})(?:étape|chapitre|page|épisode|question|séance|version|couche|article|tome|ADR|n°))[ \t\r\n]+(?=\d)/giu;
const LEADING_BEFORE_SIGN = /^[ \t\r\n]+(?=[:;!?»])/;
const LEADING = /^[ \t\r\n]+/;

export interface Typeset {
  readonly html: string;
  /** Ordinary spaces replaced, so a caller can report the volume it changed. */
  readonly replaced: number;
}

function within(text: string): { text: string; replaced: number } {
  let replaced = 0;
  const count = (): string => {
    replaced++;
    return NBSP;
  };
  let result = text;
  // Order matters once: the minutes of a time are found after its hour has been bound.
  const rules = [BEFORE_SIGN, AFTER_GUILLEMET, THOUSANDS, AFTER_NUMBER, MINUTES, RANK_TOTAL];
  for (const rule of [...rules, NUMBERING]) {
    result = result.replace(rule, count);
  }
  return { text: result, replaced };
}

function readableAttributes(tag: string): { tag: string; replaced: number } {
  let replaced = 0;
  const typesetValue = (_: string, open: string, value: string, close: string): string => {
    const result = within(value);
    replaced += result.replaced;
    return `${open}${result.text}${close}`;
  };
  let result = tag.replace(READABLE_ATTRIBUTES, typesetValue);
  if (META_DESCRIPTION.test(result)) result = result.replace(META_CONTENT, typesetValue);
  return { tag: result, replaced };
}

export function typeset(html: string): Typeset {
  let replaced = 0;
  // Last character of the text reached through inline elements only; empty after any other
  // element, so a sign or a word at the start of a block never receives a leading no-break space.
  let previous = "";
  const out: string[] = [];
  for (const match of html.matchAll(TOKEN)) {
    const token = match[0];
    const verbatim = match[1];
    const name = match[2];
    if (token.startsWith("<")) {
      if (verbatim !== undefined || name === undefined || !INLINE.has(name.toLowerCase())) {
        previous = "";
      }
      if (name !== undefined && verbatim === undefined) {
        const attributes = readableAttributes(token);
        replaced += attributes.replaced;
        out.push(attributes.tag);
      } else {
        out.push(token);
      }
      continue;
    }
    let text = token;
    const continuesWord = previous !== "" && !/\s/.test(previous);
    if (continuesWord && previous !== "«" && LEADING_BEFORE_SIGN.test(text)) {
      text = text.replace(LEADING_BEFORE_SIGN, NBSP);
      replaced++;
    } else if (previous === "«" && LEADING.test(text)) {
      text = text.replace(LEADING, NBSP);
      replaced++;
    }
    const inner = within(text);
    replaced += inner.replaced;
    out.push(inner.text);
    previous = inner.text.at(-1) ?? previous;
  }
  return { html: out.join(""), replaced };
}
