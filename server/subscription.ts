/**
 * Parsing of a waitlist form (ADR 0006 §3-5). The form is closed: an unknown field, an unknown
 * value or a repeated single field refuses the request, so nothing the visitor sends can widen
 * what is stored. The honeypot is checked first and reported apart, because the server answers it
 * as a success without storing anything.
 */
import { UNIVERSE_OF, UNIVERSES, type UniverseId } from "../src/content/universes";
import { normalizeEmail } from "./email";

export interface SubscriptionRequest {
  readonly email: string;
  readonly universes: readonly UniverseId[];
  /** Reference of the application the visitor wants to hear about, e.g. "P07". */
  readonly follow: string | null;
  readonly tester: boolean;
}

export type SubscriptionParse =
  | { readonly ok: true; readonly value: SubscriptionRequest }
  | { readonly ok: false; readonly reason: "email" | "honeypot" | "field" };

const SINGLE_FIELDS = new Set(["courriel", "suivre", "testeur", "site"]);
const MULTIPLE_FIELDS = new Set(["univers"]);
const UNIVERSE_IDS = new Set<string>(UNIVERSES.map((universe) => universe.id));

const isUniverseId = (value: string): value is UniverseId => UNIVERSE_IDS.has(value);

export function parseSubscription(form: FormData): SubscriptionParse {
  const values = new Map<string, string[]>();
  for (const [name, value] of form.entries()) {
    if (typeof value !== "string") return { ok: false, reason: "field" };
    values.set(name, [...(values.get(name) ?? []), value]);
  }
  const honeypot = values.get("site");
  if (honeypot?.some((value) => value !== "")) {
    return { ok: false, reason: "honeypot" };
  }
  for (const [name, list] of values) {
    if (!SINGLE_FIELDS.has(name) && !MULTIPLE_FIELDS.has(name))
      return { ok: false, reason: "field" };
    if (SINGLE_FIELDS.has(name) && list.length > 1) return { ok: false, reason: "field" };
  }

  const email = normalizeEmail(values.get("courriel")?.[0] ?? "");
  if (email === null) return { ok: false, reason: "email" };

  const universes = [...new Set(values.get("univers") ?? [])].sort();
  if (!universes.every(isUniverseId)) return { ok: false, reason: "field" };

  const followed = values.get("suivre")?.[0] ?? "";
  if (followed !== "" && UNIVERSE_OF[followed] === undefined) return { ok: false, reason: "field" };

  const tester = values.get("testeur")?.[0];
  if (tester !== undefined && tester !== "oui") return { ok: false, reason: "field" };

  return {
    ok: true,
    value: {
      email,
      universes: universes.filter(isUniverseId),
      follow: followed === "" ? null : followed,
      tester: tester === "oui",
    },
  };
}
