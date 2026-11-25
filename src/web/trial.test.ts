import { describe, expect, test } from "bun:test";

import { MISSION_REQUESTS, type MissionRequest } from "../content/trial";
import { render } from "./html";
import { homeMain } from "./pages";
import { missionSeal } from "./trial";
import { typeset } from "./typography";

const home = typeset(render(homeMain())).html;

// The renderer escapes text and typesetting binds punctuation with no-break spaces; the page is
// compared as the reader sees it.
const ENTITIES: Readonly<Record<string, string>> = {
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
};
const read = (html: string): string =>
  html
    .replace(/&(?:#39|quot|lt|gt|amp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[  ]/g, " ");
const text = read(home);

/** The markup of one element, from its opening tag to the next opening tag of the same name. */
function element(tag: string, id: string): string {
  const start = home.indexOf(`<${tag} id="${id}"`);
  expect(start, `${tag}#${id}`).toBeGreaterThanOrEqual(0);
  const next = home.indexOf(`<${tag} `, start + 1);
  return home.slice(start, next === -1 ? undefined : next);
}

describe("the mission order of the home page (ADR 0010 §8)", () => {
  // Expected copy written from ADR 0010 §8, not from src/content/trial.ts.
  test("carries the title of the ADR, after the four moments", () => {
    expect(text).toContain("Ce qu'un agent tente, et ce qui l'arrête.");
    const moments = home.indexOf('id="moments"');
    const trial = home.indexOf('id="essai"');
    const universes = home.indexOf('id="univers"');
    expect(moments).toBeGreaterThan(-1);
    expect(trial).toBeGreaterThan(moments);
    expect(universes).toBeGreaterThan(trial);
  });

  test("the opening's first call leads to it", () => {
    expect(home).toMatch(
      /<a class="bouton bouton-nuit" href="#essai">Essayer de piéger un agent<\/a>/,
    );
  });

  test("every service is a link to its own sheet, all drawn without script", () => {
    const links = [...home.matchAll(/<a href="#ordre-([a-z]+)">/g)].map((match) => match[1]);
    expect(links).toEqual(MISSION_REQUESTS.map((request) => request.id));
    for (const request of MISSION_REQUESTS) expect(home).toContain(`id="ordre-${request.id}"`);
  });

  // Refusals as the redesign prototype showed them in its version 17, by rule name, line by line:
  // an outside record that the page must show, since the engine computes it at build time.
  const expected: Record<string, (string[] | "Fait")[]> = {
    compta: ["Fait", ["Consigne"], ["Vérification"]],
    rh: ["Fait", ["Autorisation"], "Fait"],
    commercial: [["Europe", "Modèle"], "Fait"],
    informatique: [["Installation"], ["Isolement"], "Fait"],
    support: [["Traces"], "Fait", ["Vérification"]],
  };

  test("each line shows the rules that refuse it, or « Fait »", () => {
    for (const request of MISSION_REQUESTS) {
      const sheet = element("article", `ordre-${request.id}`);
      const lines = sheet.split('<li class="ordre-ligne ').slice(1);
      const shown = lines.map((line) =>
        line.startsWith("faite")
          ? (line.match(/<span class="ordre-verdict">([^<]*)</)?.[1] ?? "")
          : [...line.matchAll(/<strong>([^<]*)<\/strong>/g)].map((match) => match[1]),
      );
      expect(shown, request.id).toEqual(expected[request.id] ?? []);
    }
  });

  test("each stub names the rules that refused something that day, and seals the sheet", () => {
    const refusedBy: Record<string, string> = {
      compta: "refusé par Consigne, Vérification",
      rh: "refusé par Autorisation",
      commercial: "refusé par Europe, Modèle",
      informatique: "refusé par Installation, Isolement",
      support: "refusé par Traces, Vérification",
    };
    for (const request of MISSION_REQUESTS) {
      const stub = read(
        element("article", `ordre-${request.id}`).split('<footer class="ordre-talon">')[1] ?? "",
      );
      expect(stub, request.id).toContain(
        `${request.time} · ${request.service} · ${refusedBy[request.id]}`,
      );
      expect(stub, request.id).toContain(
        `Sceau ${missionSeal(request)} · la moindre retouche le change`,
      );
    }
  });
});

describe("the seal of a mission order", () => {
  const request = MISSION_REQUESTS[0] as MissionRequest;

  test("is four groups of four hexadecimal digits, the same at every build", () => {
    expect(missionSeal(request)).toMatch(/^[0-9a-f]{4}( [0-9a-f]{4}){3}$/);
    expect(missionSeal(request)).toBe(missionSeal({ ...request }));
  });

  test("changes with a word of the request, and with a refusal", () => {
    const seal = missionSeal(request);
    expect(missionSeal({ ...request, request: `${request.request} ` })).not.toBe(seal);
    const [first, ...rest] = request.actions;
    if (first === undefined) throw new Error("a request without actions");
    const refusedFirst = { ...first, facts: { destination: "hors-ue" } };
    expect(missionSeal({ ...request, actions: [refusedFirst, ...rest] })).not.toBe(seal);
  });

  test("differs from one sheet to the next", () => {
    const seals = MISSION_REQUESTS.map(missionSeal);
    expect(new Set(seals).size).toBe(seals.length);
  });
});

describe("the transfer: one form for everyone (ADR 0010 §8)", () => {
  test("carries the title of the ADR, after the universes", () => {
    expect(text).toContain("Une règle ne connaît pas de chef.");
    expect(home.indexOf('id="virement"')).toBeGreaterThan(home.indexOf('id="univers"'));
  });

  const half = (side: string): string => {
    const start = home.indexOf(`<div class="virement-demi virement-${side}">`);
    expect(start, side).toBeGreaterThan(-1);
    const end = home.indexOf("</ol>", start);
    return home.slice(start, end);
  };

  test("the agent's transfer, reviewed by the accountant, respects every rule", () => {
    const agent = half("agent");
    expect(agent).not.toContain('class="arret"');
    expect(agent.match(/<span class="virement-etat">Respectée<\/span>/g)?.length).toBe(8);
  });

  test("the director's, reviewed by himself, stops on the review rule alone", () => {
    const director = half("dirigeant");
    const stops = [
      ...director.matchAll(/<li class="arret">.*?<span class="virement-regle">([^<]*)<\/span>/g),
    ];
    expect(stops.map((match) => read(match[1] ?? ""))).toEqual([
      "Personne ne valide son propre travail, pas même un agent.",
    ]);
    expect(director).toContain('<dd class="alerte">Lui-même</dd>');
    expect(director.match(/<span class="virement-etat">Bloque<\/span>/g)?.length).toBe(1);
  });
});
