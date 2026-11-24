/**
 * Corpus of the parity test (ADR 0009, ADR-0063 D5 (a)). Each scenario names its source, and
 * each source is tied to something the parity test checks:
 *
 * - `reference-tests`: the scenario names the tests of the reference it replays (`covers`). The
 *   parity test reads `TEST_FILES`: a cited test that does not exist fails, and a test of those
 *   files that no scenario covers fails unless `NOT_IN_CORPUS` says why;
 * - `porting-risks`: a trap of `docs/method/TS-TO-RUST-PORTING-RISKS.md` (project-governance) for
 *   a construction of the reference, named in `constructs` as it is written there; a construction
 *   no longer found in the reference files fails, so a stale risk cannot stay in the count;
 * - `authored`: cases written here for edges no test of the reference reaches — address traps,
 *   hosts, methods, header bytes. Nothing outside this file lists them, and the label says so.
 *
 * A scenario may carry an `admitted` divergence: the port answers otherwise than the pinned
 * reference, on purpose (ADR 0009). Both sides are then held to the outcomes written here, and
 * the divergence holds only for the Bun revision it names.
 *
 * A request target may hold `{confirm}` or `{unsubscribe}` (the token of the latest message) or
 * `{confirm:N}` (the token of message N, from 0): each side reads its own messages.
 */

export const SOURCES = ["reference-tests", "porting-risks", "authored"] as const;
export type Source = (typeof SOURCES)[number];

/** The test files of the reference whose every test is replayed or excused. */
export const TEST_FILES = [
  "server/http.test.ts",
  "server/store.test.ts",
  "server/purge.test.ts",
] as const;
export type TestFile = (typeof TEST_FILES)[number];

export interface TestRef {
  readonly file: TestFile;
  readonly test: string;
}

const httpTest = (test: string): TestRef => ({ file: "server/http.test.ts", test });
const storeTest = (test: string): TestRef => ({ file: "server/store.test.ts", test });
const purgeTest = (test: string): TestRef => ({ file: "server/purge.test.ts", test });

/** Tests of `TEST_FILES` that no scenario replays, and where their claim is held instead. */
export const NOT_IN_CORPUS: readonly (TestRef & { readonly reason: string })[] = [
  {
    ...httpTest("the limiter allows a new window once the old one has passed"),
    reason: "needs a ten-minute clock; Rust limiter::tests hold the windows",
  },
  {
    ...httpTest("the logger redacts any value shaped like an address"),
    reason: "a function of the logger; Rust log::tests::redacts_any_value_shaped_like_an_address",
  },
  {
    ...httpTest(
      "the answer never waits for the send; a failed send is logged and the request stays pending, so a retry works",
    ),
    reason:
      "needs a mailer held mid-send; Rust http::tests::the_answer_never_waits_for_the_send_and_a_failed_send_is_logged and no_mail_work_runs_before_the_answer_on_either_path",
  },
  {
    ...httpTest("a store failure answers 500 without detail and is logged"),
    reason:
      "needs a failing store; Rust http::tests::a_store_failure_answers_500_without_detail_and_is_logged",
  },
  {
    ...storeTest("migrate is idempotent"),
    reason:
      "the port runs its own migration at every start; parity compares the two table definitions",
  },
];

/** What one step answers, for an admitted divergence. */
export interface Outcome {
  readonly status: number;
  readonly location?: string;
  /** Rows of `subscribers` after the step. */
  readonly rows: number;
  /** Messages written since the start of the scenario, after the step. */
  readonly messages: number;
}

export interface AdmittedDivergence {
  /** The Bun revision of the reference this divergence was measured against. */
  readonly runtime: string;
  readonly reason: string;
  readonly reference: readonly Outcome[];
  readonly port: readonly Outcome[];
}

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

/** Moves every row's `requested_at` back by `hours` and `seconds`, in both databases. */
export interface AgeStep {
  readonly kind: "age";
  readonly hours: number;
  readonly seconds?: number;
}

/** The whole seconds an ageing step moves `requested_at` back. */
export const ageSeconds = (step: AgeStep): number => step.hours * 3600 + (step.seconds ?? 0);

/** Runs the purge of expired requests once. */
export interface PurgeStep {
  readonly kind: "purge";
}

export type Step = HttpStep | AgeStep | PurgeStep;

export interface Scenario {
  readonly id: string;
  readonly source: Source;
  readonly steps: readonly Step[];
  /** `reference-tests`: the tests of the reference this scenario replays. */
  readonly covers?: readonly TestRef[];
  /** `porting-risks`: the constructions of the reference it exercises, as written there. */
  readonly constructs?: readonly string[];
  readonly admitted?: AdmittedDivergence;
}

/** The pinned reference runtime (`toolchains/bun.json` of project-governance, CI and local). */
export const PINNED_BUN_REVISION = "57f349f6307cf89dcfb8893f003c1ef421a74589";

const ADMITTED_STRICTER =
  "Bun 1.4.4 refuses it, the pinned 1.4.0-canary.1 accepts it; the port refuses it (ADR 0009)";

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
  source: "authored",
  steps: [subscribe(`courriel=${raw}`)],
});

/** An address the pinned reference stores and the port refuses (`ADMITTED_STRICTER`). */
const refusedAddress = (id: string, raw: string): Scenario => ({
  ...addressCase(id, raw),
  admitted: {
    runtime: PINNED_BUN_REVISION,
    reason: ADMITTED_STRICTER,
    reference: [{ status: 303, location: "/inscription/merci/", rows: 1, messages: 1 }],
    port: [{ status: 303, location: "/inscription/erreur/", rows: 0, messages: 0 }],
  },
});

export function corpus(etags: { readonly css: string; readonly cssGzip: string }): Scenario[] {
  const identity: readonly [string, string] = ["Accept-Encoding", "identity"];
  const gzip: readonly [string, string] = ["Accept-Encoding", "gzip"];
  return [
    // --- reference-tests ----------------------------------------------------------------------
    {
      id: "static files, typed, revalidated, compressed",
      source: "reference-tests",
      covers: [
        httpTest("every response carries the security headers"),
        httpTest("serves directory indexes, typed"),
        httpTest("every file is revalidated, never cached as immutable"),
        httpTest("compresses when the client accepts gzip"),
      ],
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
      source: "reference-tests",
      covers: [
        httpTest("a file answers 304 to its own digest, and 200 with the body to any other"),
        httpTest("the gzip representation has its own digest"),
        httpTest("a missing file carries no digest, so its 404 is never revalidated into a 304"),
      ],
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
      source: "reference-tests",
      covers: [
        httpTest("an unknown path answers 404 with the generated page"),
        httpTest("a path escaping the site is refused"),
        httpTest("a malformed percent-encoding is a 404 with the generated page, not a crash"),
      ],
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
      source: "reference-tests",
      covers: [httpTest("another method than GET, HEAD or the waitlist POSTs answers 405")],
      steps: [
        { kind: "http", method: "DELETE", target: "/" },
        post("/", "x=1"),
        post("/confirmer", "x=1"),
        { kind: "http", method: "PUT", target: "/inscription", headers: FORM, body: "x=1" },
      ],
    },
    {
      id: "mirror hosts redirect, unknown hosts are misdirected",
      source: "reference-tests",
      covers: [
        httpTest("a mirror host gets a permanent redirect to the canonical origin, path kept"),
        httpTest("an unknown host is refused as misdirected"),
      ],
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
      source: "reference-tests",
      covers: [
        httpTest("a valid subscription answers 303 merci and writes one confirmation"),
        // The log lines of both sides are compared, and the reference's carry none of these.
        httpTest("logs carry no address, no token and no client address"),
        storeTest("a request creates a pending row holding only the declared fields"),
      ],
      steps: [subscribe("courriel=a%40example.org&univers=apprendre&suivre=P07")],
    },
    {
      id: "confirm from the message, confirm again, unsubscribe in one click",
      source: "reference-tests",
      covers: [
        httpTest("confirm from the message link, then unsubscribe in one click"),
        storeTest("confirm moves a pending row to confirmed and spends its confirmation digest"),
        storeTest("second confirmation is idempotent: invalid, never an error"),
        storeTest("unsubscribe deletes the row, whatever its state"),
      ],
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
      source: "reference-tests",
      covers: [
        httpTest("a known confirmed address answers the same 303 and writes nothing"),
        storeTest("a request on a confirmed address changes nothing"),
      ],
      steps: [
        subscribe("courriel=a%40example.org&testeur=oui"),
        get("/confirmer?jeton={confirm}"),
        subscribe("courriel=a%40example.org&univers=apprendre"),
      ],
    },
    {
      id: "a pending address is renewed and its first link stops working",
      source: "reference-tests",
      covers: [storeTest("a second request on a pending address renews its digests and interests")],
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
      source: "reference-tests",
      covers: [httpTest("a filled honeypot answers 303 merci and stores nothing")],
      steps: [subscribe("courriel=a%40example.org&site=x"), subscribe("site=x&role=admin")],
    },
    {
      id: "an invalid request answers erreur and stores nothing",
      source: "reference-tests",
      covers: [httpTest("an invalid request answers 303 erreur and stores nothing")],
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
      source: "reference-tests",
      covers: [httpTest("the sixth request in ten minutes from one client gets 429")],
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
      source: "reference-tests",
      covers: [
        httpTest("a cross-site POST is refused 403"),
        httpTest("a body over 4 KiB is refused 413 and a wrong content type 415"),
      ],
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
      source: "reference-tests",
      covers: [
        httpTest("GET /desinscrire shows a form and never deletes"),
        httpTest("a browser unsubscribe redirects to the confirmation page"),
      ],
      steps: [
        subscribe("courriel=a%40example.org"),
        get("/desinscrire?jeton={unsubscribe}"),
        post("/desinscrire?jeton={unsubscribe}", ""),
        post("/desinscrire?jeton={unsubscribe}", ""),
      ],
    },
    {
      id: "missing, empty, unknown and hostile tokens",
      source: "reference-tests",
      covers: [
        storeTest("an unknown confirmation digest is invalid"),
        storeTest("unsubscribe with an unknown digest is invalid and deletes nothing"),
      ],
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
      source: "reference-tests",
      covers: [
        storeTest("confirm refuses a request older than 48 hours"),
        purgeTest("a purge logs how many requests it removed, never which"),
      ],
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
      source: "reference-tests",
      covers: [
        storeTest(
          "purgeExpired deletes only pending rows older than 48 hours and returns their number",
        ),
      ],
      steps: [
        subscribe("courriel=a%40example.org"),
        subscribe("courriel=b%40example.org"),
        { kind: "age", hours: 47 },
        get("/confirmer?jeton={confirm:0}"),
        { kind: "age", hours: 2 },
        { kind: "purge" },
      ],
    },
    {
      // The 48 hours to the second's scale of the test: 30 s short of them a request is kept and
      // confirmed, 30 s past them it is refused and purged. The steps take well under a second,
      // so a change of the delay by a minute fails here, where 47 and 49 hours would not see it.
      id: "the 48 hours hold within half a minute, for the purge and the confirmation",
      source: "authored",
      steps: [
        subscribe("courriel=a%40example.org"),
        subscribe("courriel=b%40example.org"),
        subscribe("courriel=c%40example.org"),
        { kind: "age", hours: 47, seconds: 3600 - 30 },
        { kind: "purge" },
        get("/confirmer?jeton={confirm:0}"),
        { kind: "age", hours: 0, seconds: 60 },
        get("/confirmer?jeton={confirm:2}"),
        { kind: "purge" },
      ],
    },
    {
      // A renewal restarts the 48 hours: the renewed request survives a purge its first request
      // would not have, and is confirmed at a time after it was renewed.
      id: "a renewal restarts the delay: ageing, renewal, purge, confirmation",
      source: "authored",
      steps: [
        subscribe("courriel=a%40example.org"),
        subscribe("courriel=b%40example.org"),
        { kind: "age", hours: 47 },
        subscribe("courriel=a%40example.org&univers=apprendre"),
        { kind: "age", hours: 2 },
        { kind: "purge" },
        get("/confirmer?jeton={confirm:2}"),
        { kind: "age", hours: 47 },
        { kind: "purge" },
      ],
    },

    // --- porting-risks ------------------------------------------------------------------------
    {
      id: "TextDecoder drops a leading byte order mark",
      source: "porting-risks",
      constructs: ["new TextDecoder"],
      steps: [subscribe(bytes([0xef, 0xbb, 0xbf], "courriel=a%40example.org"))],
    },
    {
      id: "TextDecoder replaces invalid UTF-8, raw or escaped",
      source: "porting-risks",
      constructs: ["new TextDecoder"],
      steps: [
        subscribe(bytes("courriel=a", [0xff], "%40example.org")),
        subscribe("courriel=b%FF%40example.org"),
      ],
    },
    {
      id: "URLSearchParams drops one leading question mark",
      source: "porting-risks",
      constructs: ["new URLSearchParams"],
      steps: [subscribe("?courriel=a%40example.org"), subscribe("??courriel=b%40example.org")],
    },
    {
      id: "trim strips U+FEFF and U+00A0, keeps U+0085; /\\s/ refuses U+2028 inside",
      source: "porting-risks",
      constructs: [".trim()", "\\s/"],
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
      constructs: [".sort("],
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
      constructs: [".toLowerCase()"],
      steps: [
        subscribe("courriel=a%40%C4%B0stanbul.example"),
        subscribe("courriel=b%40%CE%A3%CE%91%CE%A3.example"),
        subscribe("courriel=%C3%89lodie%40EXAMPLE.ORG"),
      ],
    },
    {
      id: "decodeURIComponent of a path: valid, encoded slash, surrogate, dot segments",
      source: "porting-risks",
      constructs: ["decodeURIComponent("],
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
      constructs: ["headers.get("],
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
      constructs: [".startsWith(", ".includes("],
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
      constructs: [".trim()"],
      steps: [
        subscribe("courriel=a%40example.org"),
        post("/desinscrire?jeton={unsubscribe}", " List-Unsubscribe=One-Click\r\n", []),
        post("/desinscrire?jeton=x", "list-unsubscribe=one-click", []),
      ],
    },
    {
      id: "the form limit is 4096 bytes, declared or read",
      source: "porting-risks",
      constructs: ["4096"],
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
    refusedAddress("an invalid punycode domain", "a%40xn--a.example"),
    addressCase("a leading hyphen", "a%40-a.example"),
    addressCase("an underscore", "a%40a_b.example"),
    refusedAddress("a forbidden percent", "a%40exa%25mple.fr"),
    refusedAddress("a percent in an international label", "a%40%C3%A9%25.fr"),
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
      source: "authored",
      steps: [
        subscribe("courriel=Ana%40Example.org"),
        subscribe("courriel=ana%40EXAMPLE.org"),
        subscribe("courriel=Ana%40example.ORG"),
      ],
    },

    // --- transport ----------------------------------------------------------------------------
    {
      id: "unknown and unusual methods",
      source: "authored",
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
      source: "authored",
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
      source: "authored",
      steps: [
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
    {
      // The pinned reference builds a URL from an invalid `xn--` label and answers 421 for an
      // unknown host; Bun 1.4.4 and the port refuse to build it and answer 500.
      id: "hosts with an invalid punycode label",
      source: "authored",
      steps: [get("/", [], "xn--a.fr"), get("/", [], "XN--A.libreia.fr")],
      admitted: {
        runtime: PINNED_BUN_REVISION,
        reason: ADMITTED_STRICTER,
        reference: [
          { status: 421, rows: 0, messages: 0 },
          { status: 421, rows: 0, messages: 0 },
        ],
        port: [
          { status: 500, rows: 0, messages: 0 },
          { status: 500, rows: 0, messages: 0 },
        ],
      },
    },
    {
      // Bun reads each header byte as one code point (Latin-1), measured on 1.4.0-canary.1 and
      // 1.4.4: the UTF-8 bytes of "é" arrive as "Ã©", and the value is still compared.
      id: "header values with non-ASCII bytes",
      source: "authored",
      steps: [
        subscribe("courriel=a%40example.org", [
          ["Content-Type", "application/x-www-form-urlencoded; x=é"],
          ["Sec-Fetch-Site", "same-origin"],
        ]),
        subscribe("courriel=b%40example.org", [
          ["Content-Type", "application/x-www-form-urlencoded"],
          ["Sec-Fetch-Site", "same-originé"],
        ]),
        get("/", [["Accept-Encoding", "gzip, é"]]),
        get("/assets/site.css", [identity, ["If-None-Match", `"é", ${etags.css}`]]),
      ],
    },
  ];
}
