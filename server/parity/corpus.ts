/**
 * Corpus of the parity test (ADR 0009, ADR-0063 D5 (a)). Each scenario names its source; an
 * input outside the declared sources does not enter without one.
 *
 * - `http-tests`: the calls `server/http.test.ts` makes to the reference;
 * - `porting-risks`: the traps of `docs/method/TS-TO-RUST-PORTING-RISKS.md` (project-governance)
 *   for the constructions the reference uses: `trim` and `/\s/`, `TextDecoder`,
 *   `URLSearchParams`, `decodeURIComponent`, `toLowerCase`, `sort`, `Headers.get`, `startsWith`;
 * - `addresses`: address traps — unicode, IDN, `+`, case, spaces, lengths, forbidden characters;
 * - `transport`: hosts, methods and sizes at the edge of the routes.
 *
 * A request target may hold `{confirm}` or `{unsubscribe}` (the token of the latest message) or
 * `{confirm:N}` (the token of message N, from 0): each side reads its own messages.
 */

export const SOURCES = ["http-tests", "porting-risks", "addresses", "transport"] as const;
export type Source = (typeof SOURCES)[number];

export const CANONICAL_HOST = "libre-ia.fr";
export const ORIGIN = `https://${CANONICAL_HOST}`;
export const REDIRECT_HOSTS = ["libreia.fr", "www.libre-ia.fr", "libre-ai.fr"] as const;
export const SENDER = "Libre IA <liste@libre-ia.example>";

export interface HttpStep {
  readonly kind: "http";
  /** Raw request with `{…}` token placeholders; `Connection: close` is always sent. */
  readonly method: string;
  readonly target: string;
  readonly headers?: readonly (readonly [string, string])[];
  readonly body?: string | Uint8Array;
  /** `null` sends no Host header. */
  readonly host?: string | null;
}

/** Moves every row's `requested_at` back by this many hours, in both databases. */
export interface AgeStep {
  readonly kind: "age";
  readonly hours: number;
}

/** Runs the purge of expired requests once. */
export interface PurgeStep {
  readonly kind: "purge";
}

export type Step = HttpStep | AgeStep | PurgeStep;

export interface Scenario {
  readonly id: string;
  readonly source: Source;
  readonly steps: readonly Step[];
}

const FORM: readonly (readonly [string, string])[] = [
  ["Content-Type", "application/x-www-form-urlencoded"],
  ["Sec-Fetch-Site", "same-origin"],
];

const get = (
  target: string,
  headers: HttpStep["headers"] = [],
  host?: string | null,
): HttpStep => ({
  kind: "http",
  method: "GET",
  target,
  headers,
  ...(host === undefined ? {} : { host }),
});

const post = (
  target: string,
  body: string | Uint8Array,
  headers: HttpStep["headers"] = FORM,
): HttpStep => ({ kind: "http", method: "POST", target, headers, body });

const subscribe = (body: string | Uint8Array, headers: HttpStep["headers"] = FORM): HttpStep =>
  post("/inscription", body, headers);

const bytes = (...parts: (string | readonly number[])[]): Uint8Array => {
  const chunks = parts.map((part) =>
    typeof part === "string" ? new TextEncoder().encode(part) : Uint8Array.from(part),
  );
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

/** One subscription per address, each as its own scenario. */
const addressCase = (id: string, raw: string): Scenario => ({
  id: `address: ${id}`,
  source: "addresses",
  steps: [subscribe(`courriel=${raw}`)],
});

export function corpus(etags: { readonly css: string; readonly cssGzip: string }): Scenario[] {
  const identity: readonly [string, string] = ["Accept-Encoding", "identity"];
  const gzip: readonly [string, string] = ["Accept-Encoding", "gzip"];
  return [
    // --- http-tests ---------------------------------------------------------------------------
    {
      id: "static files, typed, revalidated, compressed",
      source: "http-tests",
      steps: [
        get("/"),
        { kind: "http", method: "HEAD", target: "/" },
        get("/", [gzip]),
        get("/applications/"),
        get("/applications"),
        get("/assets/site.css", [identity]),
        get("/assets/site.css", [gzip]),
        get("/assets/app.js"),
        get("/assets/logo.svg"),
        get("/assets/font.woff2", [gzip]),
        get("/sitemap.xml"),
        get("/robots.txt"),
        get("/data.json"),
        get("/misc.bin"),
      ],
    },
    {
      id: "a file answers 304 to its own digest",
      source: "http-tests",
      steps: [
        get("/assets/site.css", [identity, ["If-None-Match", etags.css]]),
        get("/assets/site.css", [identity, ["If-None-Match", `W/${etags.css}`]]),
        get("/assets/site.css", [identity, ["If-None-Match", `"0000", ${etags.css}`]]),
        get("/assets/site.css", [identity, ["If-None-Match", "*"]]),
        get("/assets/site.css", [identity, ["If-None-Match", '"0000"']]),
        get("/assets/site.css", [gzip, ["If-None-Match", etags.css]]),
        get("/assets/site.css", [gzip, ["If-None-Match", etags.cssGzip]]),
        get("/nope", [["If-None-Match", "*"]]),
      ],
    },
    {
      id: "missing and escaping paths answer the generated 404",
      source: "http-tests",
      steps: [
        get("/nope"),
        get("/assets/absent.css"),
        get("/..%2f..%2fetc/passwd"),
        get("/%E0%A4%A"),
        get("/nope", [gzip]),
      ],
    },
    {
      id: "another method than GET, HEAD or the waitlist POSTs answers 405",
      source: "http-tests",
      steps: [
        { kind: "http", method: "DELETE", target: "/" },
        post("/", "x=1"),
        post("/confirmer", "x=1"),
        { kind: "http", method: "PUT", target: "/inscription", headers: FORM, body: "x=1" },
      ],
    },
    {
      id: "mirror hosts redirect, unknown hosts are misdirected",
      source: "http-tests",
      steps: [
        get("/applications/?x=1", [], "libreia.fr"),
        get("/", [], "www.libre-ia.fr"),
        get("/a?", [], "libre-ai.fr"),
        get("/", [], "evil.example"),
        post("/inscription", "courriel=a%40example.org", FORM),
      ],
    },
    {
      id: "a valid subscription answers merci and writes one confirmation",
      source: "http-tests",
      steps: [subscribe("courriel=a%40example.org&univers=apprendre&suivre=P07")],
    },
    {
      id: "confirm from the message, confirm again, unsubscribe in one click",
      source: "http-tests",
      steps: [
        subscribe("courriel=a%40example.org"),
        get("/confirmer?jeton={confirm}"),
        get("/confirmer?jeton={confirm}"),
        post("/desinscrire?jeton={unsubscribe}", "List-Unsubscribe=One-Click", [
          ["Sec-Fetch-Site", "cross-site"],
        ]),
        get("/confirmer?jeton={confirm}"),
      ],
    },
    {
      id: "a known confirmed address answers the same and writes nothing",
      source: "http-tests",
      steps: [
        subscribe("courriel=a%40example.org&testeur=oui"),
        get("/confirmer?jeton={confirm}"),
        subscribe("courriel=a%40example.org&univers=apprendre"),
      ],
    },
    {
      id: "a pending address is renewed and its first link stops working",
      source: "http-tests",
      steps: [
        subscribe("courriel=a%40example.org"),
        subscribe("courriel=a%40example.org&univers=se-proteger&suivre=P36"),
        get("/confirmer?jeton={confirm:0}"),
        get("/confirmer?jeton={confirm:1}"),
        post("/desinscrire?jeton={unsubscribe:0}", ""),
      ],
    },
    {
      id: "a filled honeypot answers merci and stores nothing",
      source: "http-tests",
      steps: [subscribe("courriel=a%40example.org&site=x"), subscribe("site=x&role=admin")],
    },
    {
      id: "an invalid request answers erreur and stores nothing",
      source: "http-tests",
      steps: [
        subscribe("courriel=nope"),
        subscribe(""),
        subscribe("courriel=a%40example.org&role=admin"),
        subscribe("courriel=a%40example.org&courriel=b%40example.org"),
        subscribe("courriel=a%40example.org&suivre=constructor"),
        subscribe("courriel=a%40example.org&suivre=__proto__"),
        subscribe("courriel=a%40example.org&suivre=P99"),
      ],
    },
    {
      id: "the sixth request in ten minutes from one client gets 429",
      source: "http-tests",
      steps: [
        subscribe("courriel=a0%40example.org"),
        subscribe("courriel=a1%40example.org"),
        subscribe("courriel=nope"),
        subscribe("courriel=a3%40example.org&site=x"),
        subscribe("courriel=a4%40example.org"),
        subscribe("courriel=b%40example.org"),
        get("/"),
      ],
    },
    {
      id: "cross-site, wrong type and oversized requests are refused before the limiter",
      source: "http-tests",
      steps: [
        subscribe("courriel=a%40example.org", [
          ["Content-Type", "application/x-www-form-urlencoded"],
          ["Sec-Fetch-Site", "cross-site"],
        ]),
        subscribe("{}", [["Content-Type", "application/json"]]),
        subscribe(`courriel=${"a".repeat(5000)}`),
        subscribe("courriel=a%40example.org", [
          ["Content-Type", "application/x-www-form-urlencoded"],
        ]),
      ],
    },
    {
      id: "the unsubscribe page shows a form and never deletes; a browser unsubscribe redirects",
      source: "http-tests",
      steps: [
        subscribe("courriel=a%40example.org"),
        get("/desinscrire?jeton={unsubscribe}"),
        post("/desinscrire?jeton={unsubscribe}", ""),
        post("/desinscrire?jeton={unsubscribe}", ""),
      ],
    },
    {
      id: "missing, empty, unknown and hostile tokens",
      source: "http-tests",
      steps: [
        get("/confirmer"),
        get("/confirmer?jeton="),
        get("/confirmer?jeton=unknown"),
        post("/desinscrire", ""),
        post("/desinscrire?jeton=unknown", "List-Unsubscribe=One-Click"),
        get("/desinscrire"),
        get("/desinscrire?jeton=%3Cscript%3E%22%27%26%20%C3%A9"),
        get("/desinscrire?jeton=a&jeton=b"),
      ],
    },
    {
      id: "an expired request cannot be confirmed and is purged",
      source: "http-tests",
      steps: [
        subscribe("courriel=a%40example.org"),
        { kind: "age", hours: 49 },
        get("/confirmer?jeton={confirm}"),
        { kind: "purge" },
        get("/confirmer?jeton={confirm}"),
      ],
    },
    {
      id: "a request younger than 48 hours is confirmed and survives the purge",
      source: "http-tests",
      steps: [
        subscribe("courriel=a%40example.org"),
        subscribe("courriel=b%40example.org"),
        { kind: "age", hours: 47 },
        get("/confirmer?jeton={confirm:0}"),
        { kind: "age", hours: 2 },
        { kind: "purge" },
      ],
    },

    // --- porting-risks ------------------------------------------------------------------------
    {
      id: "TextDecoder drops a leading byte order mark",
      source: "porting-risks",
      steps: [subscribe(bytes([0xef, 0xbb, 0xbf], "courriel=a%40example.org"))],
    },
    {
      id: "TextDecoder replaces invalid UTF-8, raw or escaped",
      source: "porting-risks",
      steps: [
        subscribe(bytes("courriel=a", [0xff], "%40example.org")),
        subscribe("courriel=b%FF%40example.org"),
      ],
    },
    {
      id: "URLSearchParams drops one leading question mark",
      source: "porting-risks",
      steps: [subscribe("?courriel=a%40example.org"), subscribe("??courriel=b%40example.org")],
    },
    {
      id: "trim strips U+FEFF and U+00A0, keeps U+0085; /\\s/ refuses U+2028 inside",
      source: "porting-risks",
      steps: [
        subscribe("courriel=%EF%BB%BFa%40example.org"),
        subscribe("courriel=%C2%A0b%40example.org%E3%80%80"),
        subscribe("courriel=c%C2%85%40example.org"),
        subscribe("courriel=d%E2%80%A8x%40example.org"),
        subscribe("courriel=e%C2%85"),
      ],
    },
    {
      id: "universes are deduplicated and sorted in UTF-16 order",
      source: "porting-risks",
      steps: [
        subscribe(
          "courriel=a%40example.org&univers=se-proteger&univers=apprendre&univers=se-proteger&univers=creer-publier",
        ),
        subscribe("courriel=b%40example.org&univers=apprendre&univers=%F0%9F%98%80"),
      ],
    },
    {
      id: "toLowerCase of the domain: dotted capital I and final sigma",
      source: "porting-risks",
      steps: [
        subscribe("courriel=a%40%C4%B0stanbul.example"),
        subscribe("courriel=b%40%CE%A3%CE%91%CE%A3.example"),
        subscribe("courriel=%C3%89lodie%40EXAMPLE.ORG"),
      ],
    },
    {
      id: "decodeURIComponent of a path: valid, encoded slash, surrogate, dot segments",
      source: "porting-risks",
      steps: [
        get("/caf%C3%A9.html"),
        get("/caf%c3%a9.html"),
        get("/assets%2fsite.css"),
        get("/%ED%A0%80"),
        get("/a/%2e%2e/index.html"),
        get("/a/../applications/"),
        get("/a%20b.html"),
        get("/%00"),
        get("/a%5Cb"),
        get("/.hidden"),
      ],
    },
    {
      id: "Headers.get joins a repeated header",
      source: "porting-risks",
      steps: [
        subscribe("courriel=a%40example.org", [
          ["Content-Type", "application/x-www-form-urlencoded"],
          ["Sec-Fetch-Site", "same-origin"],
          ["Sec-Fetch-Site", "same-origin"],
        ]),
        get("/assets/site.css", [
          ["Accept-Encoding", "identity"],
          ["If-None-Match", '"0000"'],
          ["If-None-Match", etags.css],
        ]),
      ],
    },
    {
      id: "startsWith and includes are case- and substring-sensitive",
      source: "porting-risks",
      steps: [
        subscribe("courriel=a%40example.org", [
          ["Content-Type", "Application/X-WWW-Form-Urlencoded"],
        ]),
        subscribe("courriel=b%40example.org", [
          ["Content-Type", "application/x-www-form-urlencoded; charset=UTF-8"],
        ]),
        get("/", [["Accept-Encoding", "x-gzip"]]),
        get("/", [["Accept-Encoding", "gzip;q=0"]]),
        get("/", [["Accept-Encoding", "GZIP"]]),
        get("/assets/site.css", [identity, ["If-None-Match", `w/${etags.css}`]]),
        get("/assets/site.css", [identity, ["If-None-Match", `\t${etags.css}\t`]]),
      ],
    },
    {
      id: "a one-click body is trimmed before it is compared",
      source: "porting-risks",
      steps: [
        subscribe("courriel=a%40example.org"),
        post("/desinscrire?jeton={unsubscribe}", " List-Unsubscribe=One-Click\r\n", []),
        post("/desinscrire?jeton=x", "list-unsubscribe=one-click", []),
      ],
    },
    {
      id: "the form limit is 4096 bytes, declared or read",
      source: "porting-risks",
      steps: [
        subscribe(`courriel=a%40example.org&site=${"x".repeat(4096 - 30)}`),
        subscribe(`courriel=a%40example.org&site=${"x".repeat(4096 - 29)}`),
        post("/desinscrire?jeton=x", "y".repeat(4097), []),
      ],
    },

    // --- addresses ----------------------------------------------------------------------------
    addressCase("case and spaces", "++Marie.Dupont%40Example.ORG%20"),
    addressCase("a plus sign sent raw is a space", "a+liste%40example.org"),
    addressCase("a plus sign sent encoded", "a%2Bliste%40example.org"),
    addressCase("an international domain", "jos%C3%A9%40ex%C3%A4mple.fr"),
    addressCase("an ideographic full stop", "a%40b%E3%80%82example"),
    addressCase("sharp s, non-transitional", "a%40%C3%9F.example"),
    addressCase("a punycode domain", "a%40xn--zca.example"),
    addressCase("an invalid punycode domain", "a%40xn--a.example"),
    addressCase("a leading hyphen", "a%40-a.example"),
    addressCase("an underscore", "a%40a_b.example"),
    addressCase("a forbidden percent", "a%40exa%25mple.fr"),
    addressCase("a percent in an international label", "a%40%C3%A9%25.fr"),
    addressCase("an asterisk", "a%40a*b.fr"),
    addressCase("an invalid punycode label beside an international one", "a%40%C3%A9.xn--a.fr"),
    addressCase("a valid punycode label beside an international one", "a%40%C3%A9.xn--zca.fr"),
    addressCase("a zero-width joiner in the domain", "a%40a%E2%80%8Db.fr"),
    addressCase("a right-to-left digit in the domain", "a%40%D9%A1.fr"),
    addressCase("a leading combining mark in the domain", "a%40%CC%80a.fr"),
    addressCase("a soft hyphen in the domain", "a%40a%C2%ADb.fr"),
    addressCase("a caret in the domain", "a%40a%5Eb.fr"),
    addressCase("a bracketed address literal", "a%40%5B127.0.0.1%5D"),
    addressCase("an IPv4 domain", "a%40127.0.0.1"),
    addressCase("a trailing dot", "a%40example.org."),
    addressCase("an empty label", "a%40example..org"),
    addressCase("no dot", "a%40localhost"),
    addressCase("two at signs", "a%40b%40example.org"),
    addressCase("an emoji local part", "%F0%9F%98%80%40example.org"),
    addressCase("a 64-byte local part", `${"a".repeat(64)}%40example.org`),
    addressCase("a 65-byte local part", `${"a".repeat(65)}%40example.org`),
    addressCase("a 64-byte local part in two-byte letters", `${"%C3%A9".repeat(32)}%40example.org`),
    addressCase(
      "254 bytes in all",
      `${"a".repeat(64)}%40${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.fr`,
    ),
    addressCase(
      "255 bytes in all",
      `${"a".repeat(64)}%40${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(59)}.fr`,
    ),
    addressCase("a control character", "a%00%40example.org"),
    addressCase("a line break", "a%40example.org%0D%0ABcc%3A%20b%40example.org"),
    addressCase("a tab inside", "a%09b%40example.org"),
    addressCase("a delete character", "a%7F%40example.org"),
    addressCase("a zero-width space", "a%E2%80%8B%40example.org"),
    addressCase("an uppercase domain with a digit", "a%40EXAMPLE2.ORG"),
    {
      id: "address: the local part keeps its case, the domain is folded",
      source: "addresses",
      steps: [
        subscribe("courriel=Ana%40Example.org"),
        subscribe("courriel=ana%40EXAMPLE.org"),
        subscribe("courriel=Ana%40example.ORG"),
      ],
    },

    // --- transport ----------------------------------------------------------------------------
    {
      id: "unknown and unusual methods",
      source: "transport",
      steps: [
        { kind: "http", method: "OPTIONS", target: "/" },
        { kind: "http", method: "PATCH", target: "/desinscrire" },
        { kind: "http", method: "HEAD", target: "/desinscrire?jeton=x" },
        { kind: "http", method: "HEAD", target: "/nope" },
        get("/inscription"),
        get("/inscription/merci/"),
      ],
    },
    {
      id: "host header forms",
      source: "transport",
      steps: [
        get("/", [], "LIBRE-IA.FR"),
        get("/", [], "libre-ia.fr:8443"),
        get("/", [], "libre-ia.fr."),
        get("/", [], "libre-ia.fr:abc"),
        get("/x/y?z=%20", [], "LibreIA.fr:80"),
      ],
    },
    {
      id: "hosts the reference cannot build a URL from",
      source: "transport",
      steps: [
        get("/", [], "xn--a.fr"),
        get("/", [], "XN--A.libreia.fr"),
        get("/", [], "a@libre-ai.fr"),
        get("/", [], "libre-ia.fr:99999"),
        get("/", [], "libre-ia.fr:+1"),
        get("/", [], "é.fr"),
        get("/", [], "a%b.fr"),
        get("/", [], "a%41.fr"),
        get("/", [], "1.2.3.256"),
        get("/", [], "0x7f.1"),
        get("/", [], "[::1]:80"),
        get("/", [], "a`b.fr"),
        get("/", [], ""),
      ],
    },
  ];
}
