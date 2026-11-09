/**
 * Header contract (G6): reads the committed Caddyfile and checks the directives the
 * site depends on. The site ships no script and no connection, so any directive that
 * would allow one is a violation, not a configuration choice.
 */

export interface HeaderReport {
  readonly examined: number;
  readonly violations: readonly string[];
}

// Each rule: the header must be present and must contain the directive.
const REQUIRED_DIRECTIVES: readonly { readonly rule: string; readonly directive: string }[] = [
  { rule: "header.csp_script_src", directive: "script-src 'none'" },
  { rule: "header.csp_connect_src", directive: "connect-src 'none'" },
  { rule: "header.csp_form_action", directive: "form-action 'none'" },
  { rule: "header.csp_object_src", directive: "object-src 'none'" },
];

const REQUIRED_HEADERS: readonly { readonly rule: string; readonly name: string }[] = [
  { rule: "header.hsts_missing", name: "Strict-Transport-Security" },
  { rule: "header.frame_options_missing", name: "X-Frame-Options" },
  { rule: "header.nosniff_missing", name: "X-Content-Type-Options" },
  { rule: "header.referrer_policy_missing", name: "Referrer-Policy" },
];

// A header line is `Name "value"`; a missing line is a violation, never a default.
function headerLine(caddyfile: string, name: string): string | undefined {
  return caddyfile.split("\n").find((line) => line.trimStart().startsWith(name));
}

export function checkSecurityHeaders(caddyfile: string): HeaderReport {
  const violations: string[] = [];
  let examined = 0;

  const csp = headerLine(caddyfile, "Content-Security-Policy");
  for (const { rule, directive } of REQUIRED_DIRECTIVES) {
    examined += 1;
    if (csp === undefined || !csp.includes(directive)) violations.push(rule);
  }
  // Unsafe inline and remote script sources are refused outright.
  examined += 1;
  if (csp !== undefined && /script-src[^;"]*'unsafe-inline'/.test(csp)) {
    violations.push("header.csp_script_src");
  }

  for (const { rule, name } of REQUIRED_HEADERS) {
    examined += 1;
    if (headerLine(caddyfile, name) === undefined) violations.push(rule);
  }
  return { examined, violations };
}
