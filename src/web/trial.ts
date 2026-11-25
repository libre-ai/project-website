/**
 * The trial of the home page (ADR 0010 §8): the mission order of an agent (sketch E1-A) and one
 * transfer form for everyone (sketch E2-A), drawn as the redesign prototype judged in its
 * version 17 draws them at rest.
 *
 * Nothing here says which rule stops an action: the rule engine of src/client/logic.ts computes
 * every refusal at build time from the facts the action states (ADR 0010 §4). The page is complete
 * without script (ADR 0005 §1): the five services are an in-page menu and five sheets, which the
 * shared tabs module (src/client/dom/tabs.ts) turns into tabs.
 */
import { createHash } from "node:crypto";

import { defaultFacts, type Facts, trippedRules } from "../client/logic";
import {
  MISSION_ORDER,
  MISSION_REQUESTS,
  type MissionAction,
  type MissionRequest,
  TRANSFER,
  TRANSFER_SECTION,
  TRIAL_FIELDS,
  TRIAL_RULES,
  type TransferRequest,
  type TrialRule,
} from "../content/trial";
import { type Html, h, raw } from "./html";

const DEFAULTS = defaultFacts(TRIAL_FIELDS);

/** The situations are illustrations of the intended chain, marked as such (ADR 0007 §4). */
const ILLUSTRATION = "Illustration";

/** The rules an action trips, computed by the engine, never written by hand. */
export function refusals(facts: Facts): TrialRule[] {
  return trippedRules(TRIAL_RULES, facts, DEFAULTS);
}

const facet = (index: 1 | 2 | 3 | 4 | 5): string => `var(--facette-${index})`;

/**
 * One faceted pictogram per rule, 64 x 64, from the prototype (tools/recap.ts, `corpsPicto`),
 * coloured by the facet tokens of the universe that protects (`univers-se-proteger`).
 */
function rulePictogram(id: string): string {
  const [f1, f2, f3, f4, f5] = [facet(1), facet(2), facet(3), facet(4), facet(5)];
  const stars = Array.from({ length: 12 }, (_, i) => {
    const angle = (Math.PI / 6) * i;
    const x = 32 + 17 * Math.cos(angle);
    const y = 32 + 17 * Math.sin(angle);
    const p = (dx: number, dy: number): string => `${(x + dx).toFixed(1)},${(y + dy).toFixed(1)}`;
    return `<polygon points="${p(0, -4)} ${p(1.3, -1.3)} ${p(4, 0)} ${p(1.3, 1.3)} ${p(0, 4)} ${p(-1.3, 1.3)} ${p(-4, 0)} ${p(-1.3, -1.3)}" fill="${f5}"/>`;
  }).join("");
  const pins = [22, 32, 42]
    .map(
      (v) =>
        `<rect x="${v - 2}" y="6" width="4" height="10" rx="1.5" fill="${f3}"/><rect x="${v - 2}" y="48" width="4" height="10" rx="1.5" fill="${f3}"/><rect x="6" y="${v - 2}" width="10" height="4" rx="1.5" fill="${f3}"/><rect x="48" y="${v - 2}" width="10" height="4" rx="1.5" fill="${f3}"/>`,
    )
    .join("");
  const bodies: Readonly<Record<string, string>> = {
    europe: `<circle cx="32" cy="32" r="27" fill="${f2}"/><circle cx="32" cy="32" r="27" fill="none" stroke="${f3}" stroke-width="2"/>${stars}`,
    modele: `${pins}<rect x="14" y="14" width="36" height="36" rx="5" fill="${f4}"/><polygon points="14,14 50,14 14,50" fill="${f5}" opacity="0.35"/><rect x="22" y="22" width="20" height="20" rx="3" fill="${f2}"/><path d="M27 33 L31 37 L38 28" fill="none" stroke="${f5}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    isole: `<path d="M20 30 V20 a12 12 0 0 1 24 0 V30" fill="none" stroke="${f4}" stroke-width="6"/><polygon points="12,30 52,30 52,58 12,58" fill="${f3}"/><polygon points="32,30 52,30 52,58 32,58" fill="${f4}"/><circle cx="32" cy="42" r="4" fill="${f1}"/><rect x="30.5" y="44" width="3" height="7" fill="${f1}"/>`,
    autorisation: `<circle cx="20" cy="22" r="13" fill="${f4}"/><circle cx="20" cy="22" r="5" fill="${f1}"/><polygon points="28,28 34,24 58,48 52,54" fill="${f4}"/><polygon points="28,28 31,26 55,50 52,54" fill="${f5}"/><polygon points="44,40 50,34 54,38 48,44" fill="${f3}"/><polygon points="50,46 54,42 58,46 54,50" fill="${f3}"/>`,
    consigne: `<polygon points="14,6 42,6 50,14 50,58 14,58" fill="${f1}" stroke="${f3}" stroke-width="2"/><polygon points="42,6 50,14 42,14" fill="${f3}"/><rect x="20" y="20" width="22" height="3.5" rx="1.75" fill="${f3}"/><rect x="20" y="28" width="16" height="3.5" rx="1.75" fill="${f3}"/><path d="M40 34 L54 38 L52 50 L40 58 L28 50 L26 38 Z" fill="${f4}"/><path d="M34 46 L39 51 L47 41" fill="none" stroke="${f1}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    installation: `<polygon points="32,10 56,22 32,34 8,22" fill="${f2}"/><polygon points="8,22 32,34 32,58 8,46" fill="${f3}"/><polygon points="32,34 56,22 56,46 32,58" fill="${f4}"/><polygon points="20,16 44,28 44,34 20,22" fill="${f5}" opacity="0.55"/><circle cx="44" cy="44" r="7" fill="${f5}"/><circle cx="44" cy="44" r="3" fill="${f2}"/>`,
    relecture: `<polygon points="38,40 44,34 60,50 54,56" fill="${f5}"/><circle cx="27" cy="27" r="20" fill="${f2}"/><circle cx="27" cy="27" r="20" fill="none" stroke="${f4}" stroke-width="5"/><path d="M18 27 L24 33 L36 21" fill="none" stroke="${f5}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    traces: `<ellipse cx="20" cy="40" rx="8" ry="12" fill="${f4}"/><circle cx="14" cy="23" r="3" fill="${f4}"/><circle cx="20" cy="21" r="3" fill="${f4}"/><circle cx="26" cy="23" r="3" fill="${f4}"/><ellipse cx="44" cy="28" rx="8" ry="12" fill="none" stroke="${f3}" stroke-width="2" stroke-dasharray="3 3"/><circle cx="38" cy="11" r="3" fill="none" stroke="${f3}" stroke-width="1.5" stroke-dasharray="2 2"/><circle cx="44" cy="9" r="3" fill="none" stroke="${f3}" stroke-width="1.5" stroke-dasharray="2 2"/><circle cx="50" cy="11" r="3" fill="none" stroke="${f3}" stroke-width="1.5" stroke-dasharray="2 2"/>`,
  };
  const body = bodies[id];
  if (body === undefined) throw new Error(`rule ${id} has no pictogram`);
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}

/** Hand-drawn arrows, in the ink of the note they follow. */
const ARROW = `<svg class="fleche-main" viewBox="0 0 60 44" aria-hidden="true"><path d="M4 6 C 22 0, 44 10, 50 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M42 27 L50 34 L54 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW_UP = `<svg class="fleche-main fleche-haut" viewBox="0 0 40 44" aria-hidden="true"><path d="M30 40 C 10 34, 8 18, 18 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M11 12 L18 5 L23 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const pictogram = (rule: TrialRule, className: string): Html =>
  h("span", { class: `${className} univers-se-proteger` }, raw(rulePictogram(rule.id)));

/**
 * The seal of a sheet: the start of the SHA-256 of its request and of each action with the rules
 * it trips, in groups of four. Changing a word, or a refusal, changes it.
 */
export function missionSeal(request: MissionRequest): string {
  const content = JSON.stringify({
    demande: request.request,
    actions: request.actions.map((action) => [
      action.text,
      refusals(action.facts).map((r) => r.id),
    ]),
  });
  const hex = createHash("sha256").update(content).digest("hex").slice(0, 16);
  return hex.match(/.{4}/g)?.join(" ") ?? hex;
}

function field(term: string, value: string, wide = false, alert = false): Html {
  return h(
    "div",
    wide ? { class: "large" } : {},
    h("dt", {}, term),
    h("dd", alert ? { class: "alerte" } : {}, value),
  );
}

function actionLine(action: MissionAction): Html {
  const rules = refusals(action.facts);
  if (rules.length === 0) {
    return h(
      "li",
      { class: "ordre-ligne faite" },
      h("span", { class: "ordre-action" }, action.text),
      h("span", { class: "ordre-verdict" }, MISSION_ORDER.done),
    );
  }
  return h(
    "li",
    { class: "ordre-ligne refusee" },
    h("div", { class: "ordre-pli" }, h("span", { class: "ordre-action" }, action.text)),
    h(
      "div",
      { class: "ordre-marge" },
      rules.map((rule) =>
        h(
          "p",
          { class: "ordre-regle" },
          pictogram(rule, "regle-pic"),
          h("span", {}, h("strong", {}, rule.name), " ", rule.rule),
        ),
      ),
      h("p", { class: "ordre-pourquoi" }, action.why ?? ""),
      h("p", { class: "note-main ordre-note-pli" }, MISSION_ORDER.noteFold, raw(ARROW)),
    ),
  );
}

function stub(request: MissionRequest): Html {
  const names = [
    ...new Set(request.actions.flatMap((action) => refusals(action.facts).map((r) => r.name))),
  ];
  return h(
    "footer",
    { class: "ordre-talon" },
    h("p", { class: "ordre-talon-titre" }, MISSION_ORDER.stub),
    h(
      "p",
      {},
      `${request.time} · ${request.service} · `,
      names.length > 0
        ? `${MISSION_ORDER.refusedBy} ${names.join(", ")}`
        : MISSION_ORDER.nothingRefused,
    ),
    h(
      "p",
      { class: "ordre-sceau" },
      `${MISSION_ORDER.seal} ${missionSeal(request)} · ${MISSION_ORDER.tamper}`,
    ),
    h("p", { class: "note-main ordre-note-talon" }, MISSION_ORDER.noteStub, raw(ARROW)),
  );
}

function sheet(request: MissionRequest): Html {
  const titleId = `titre-ordre-${request.id}`;
  const serviceId = `service-ordre-${request.id}`;
  return h(
    "article",
    {
      id: `ordre-${request.id}`,
      class: "ordre-feuille",
      "aria-labelledby": `${titleId} ${serviceId}`,
    },
    h(
      "header",
      { class: "ordre-tete" },
      h("h3", { id: titleId }, MISSION_ORDER.sheet),
      h("p", { class: "ordre-heure" }, request.time),
    ),
    // The company and its day are drawn to show the rules at work (ADR 0007 §4).
    h("p", { class: "illustration" }, ILLUSTRATION),
    h(
      "dl",
      { class: "champs" },
      h(
        "div",
        {},
        h("dt", {}, MISSION_ORDER.requestedBy),
        h("dd", { id: serviceId }, request.service),
      ),
      field(MISSION_ORDER.task, request.request, true),
      field(MISSION_ORDER.mayRead, request.mayRead),
      field(MISSION_ORDER.until, request.until),
    ),
    h("p", { class: "ordre-sous" }, MISSION_ORDER.tried),
    h("ol", { class: "ordre-lignes" }, request.actions.map(actionLine)),
    h("p", { class: "ordre-rendu" }, request.outcome),
    stub(request),
  );
}

/** E1-A: a day of requests in one company, each answered by the rules, line by line. */
export function missionOrder(): Html {
  return h(
    "section",
    { class: "bloc essai", id: "essai", "aria-labelledby": "titre-essai" },
    h(
      "div",
      { class: "largeur" },
      h("h2", { id: "titre-essai", class: "titre-section" }, MISSION_ORDER.title),
      h("p", { class: "essai-consigne" }, MISSION_ORDER.lead),
      h(
        "div",
        { class: "ordre", "data-onglets": true },
        h(
          "ul",
          { "data-onglets-liste": true, "aria-label": MISSION_ORDER.services },
          MISSION_REQUESTS.map((request) =>
            h("li", {}, h("a", { href: `#ordre-${request.id}` }, request.service)),
          ),
        ),
        h("p", { class: "note-main ordre-note-onglets" }, MISSION_ORDER.noteTabs, raw(ARROW_UP)),
        MISSION_REQUESTS.map(sheet),
      ),
    ),
  );
}

function transferHalf(request: TransferRequest, side: "agent" | "dirigeant"): Html {
  const stopped = new Set(refusals(request.facts).map((rule) => rule.id));
  const blocked = stopped.size > 0;
  return h(
    "div",
    { class: `virement-demi virement-${side}` },
    h("h3", { class: "virement-type" }, TRANSFER.form),
    h(
      "dl",
      { class: "champs" },
      field(TRANSFER_SECTION.requestedBy, request.author),
      field(TRANSFER_SECTION.object, request.change, true),
      field(TRANSFER_SECTION.reviewedBy, request.reviewedBy, false, blocked),
    ),
    h(
      "ol",
      { class: "virement-grille" },
      TRIAL_RULES.map((rule) =>
        h(
          "li",
          stopped.has(rule.id) ? { class: "arret" } : {},
          pictogram(rule, "regle-pic"),
          h("span", { class: "virement-regle" }, rule.rule),
          h(
            "span",
            { class: "virement-etat" },
            stopped.has(rule.id) ? TRANSFER_SECTION.blocks : TRANSFER_SECTION.respected,
          ),
        ),
      ),
    ),
    h("p", { class: `virement-issue ${blocked ? "non" : "oui"}` }, request.outcome),
  );
}

/** E2-A: the agent's transfer and the director's, on the two halves of one form. */
export function transfer(): Html {
  return h(
    "section",
    { class: "bloc virement", id: "virement", "aria-labelledby": "titre-virement" },
    h(
      "div",
      { class: "largeur" },
      h(
        "div",
        { class: "virement-tete" },
        h("h2", { id: "titre-virement", class: "titre-section" }, TRANSFER_SECTION.title),
        h(
          "div",
          {},
          h("p", {}, TRANSFER_SECTION.text),
          h(
            "p",
            { class: "actions" },
            h(
              "a",
              { class: "bouton bouton-trait", href: TRANSFER_SECTION.call.href },
              TRANSFER_SECTION.call.label,
            ),
          ),
        ),
      ),
      h(
        "figure",
        { class: "virement-figure" },
        h(
          "div",
          { class: "virement-carte" },
          transferHalf(TRANSFER.agent, "agent"),
          transferHalf(TRANSFER.director, "dirigeant"),
        ),
        h("figcaption", { class: "note-main virement-note" }, TRANSFER.note, raw(ARROW)),
        h("p", { class: "illustration" }, ILLUSTRATION),
      ),
    ),
  );
}
