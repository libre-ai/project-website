/**
 * Escaped HTML construction for the Libre IA site (ADR 0005). Text is escaped by default; only
 * `raw` passes trusted markup (the sprite references). The builder refuses at construction what
 * the CSP forbids at run time: inline styles, event handlers, style elements, inline scripts and
 * `javascript:` URLs, so a page that violates the policy cannot be written at all.
 */
import { escapeHtml } from "../security";

export interface Html {
  readonly __html: string;
}

export type Child = Html | string | number | null | undefined | false | readonly Child[];
export type Attrs = Readonly<Record<string, string | number | boolean | null | undefined>>;

const VOID = new Set([
  "area",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "wbr",
]);
const NAME = /^[a-z][a-z0-9-]*$/;
const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction"]);

export function raw(trusted: string): Html {
  return { __html: trusted };
}

function isHtml(child: Child): child is Html {
  return typeof child === "object" && child !== null && "__html" in child;
}

function serialise(child: Child): string {
  if (child === null || child === undefined || child === false) return "";
  if (isHtml(child)) return child.__html;
  if (Array.isArray(child)) return child.map(serialise).join("");
  return escapeHtml(String(child));
}

function attribute(name: string, value: Attrs[string]): string {
  if (!NAME.test(name)) throw new Error(`html.attribute_invalid:${name}`);
  if (name === "style" || name.startsWith("on")) throw new Error(`html.attribute_refused:${name}`);
  if (value === null || value === undefined || value === false) return "";
  if (value === true) return ` ${name}`;
  const text = String(value);
  if (URL_ATTRIBUTES.has(name) && /^\s*javascript:/i.test(text))
    throw new Error("html.url_refused");
  return ` ${name}="${escapeHtml(text)}"`;
}

export function h(tag: string, attrs: Attrs, ...children: Child[]): Html {
  if (!NAME.test(tag)) throw new Error(`html.tag_invalid:${tag}`);
  if (tag === "style") throw new Error("html.tag_refused:style");
  const content = children.map(serialise).join("");
  if (tag === "script" && (content !== "" || typeof attrs.src !== "string")) {
    throw new Error("html.inline_script_refused");
  }
  const opening = `<${tag}${Object.entries(attrs)
    .map(([name, value]) => attribute(name, value))
    .join("")}>`;
  return raw(VOID.has(tag) ? opening : `${opening}${content}</${tag}>`);
}

export function fragment(...children: Child[]): Html {
  return raw(children.map(serialise).join(""));
}

export function render(child: Child): string {
  return serialise(child);
}
