/**
 * Moves the style attributes of authored HTML into generated classes (plan, Task 4). The
 * micro-demos of the applications position and stagger their parts with inline declarations;
 * under `style-src 'self'` (ADR 0005) those must live in the stylesheet. Each distinct
 * declaration gets one class `s-<prefix>-<n>`, numbered by first appearance, so the output is
 * deterministic. Declarations are checked: nothing that could close the rule, load a resource or
 * open an at-rule passes. The input is the repository's own content, never visitor input.
 */

export interface HoistResult {
  readonly html: string;
  readonly css: string;
}

const PREFIX = /^[a-z0-9-]+$/;
const UNSAFE_DECLARATION = /[{}<>@\\]|url\s*\(|expression\s*\(|image-set\s*\(/i;

export function hoistStyles(html: string, prefix: string): HoistResult {
  if (!PREFIX.test(prefix)) throw new Error(`hoist.prefix_invalid:${prefix}`);
  const classes = new Map<string, string>();
  const classFor = (declarations: string): string => {
    if (UNSAFE_DECLARATION.test(declarations)) throw new Error("hoist.declaration_refused");
    let name = classes.get(declarations);
    if (name === undefined) {
      name = `s-${prefix}-${classes.size + 1}`;
      classes.set(declarations, name);
    }
    return name;
  };

  const output = html.replace(
    /<([a-z][a-z0-9-]*)(\s[^<>]*?)?(\/?)>/gi,
    (tag, name: string, attrs = "", end: string) => {
      if (/\sstyle\s*=\s*'/i.test(attrs)) throw new Error("hoist.quote_refused");
      const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs);
      if (style === null) return tag;
      const generated = classFor(style[1] ?? "");
      const hasClass = /\sclass\s*=\s*"/i.test(attrs);
      const rewritten = hasClass
        ? attrs
            .replace(style[0], "")
            .replace(
              /(\sclass\s*=\s*")([^"]*)"/i,
              (_match: string, open: string, value: string) => `${open}${value} ${generated}"`,
            )
        : attrs.replace(style[0], ` class="${generated}"`);
      return `<${name}${rewritten}${end}>`;
    },
  );

  const css = [...classes].map(([declarations, name]) => `.${name}{${declarations}}`).join("\n");
  return { html: output, css };
}
