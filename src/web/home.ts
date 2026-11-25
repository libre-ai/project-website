/**
 * The opening and the four moments of the home page (ADR 0010 §8), drawn as the redesign
 * prototype judged in its version 17 draws them, at rest: the page is complete without script
 * (ADR 0005 §1), and the folding of the plate is a later enhancement (ADR 0010 §4).
 *
 * Drawings are faceted like the emblems and coloured only through the facet tokens of their
 * universe (`--facette-1` lit … `--facette-5` shadowed), set by its `univers-<id>` class.
 */
import { applicationOf } from "../content/applications";
import { MOMENTS, MOMENTS_TITLE, type MomentId, OPENING } from "../content/home";
import { UNIVERSES } from "../content/universes";
import { type Html, h, raw } from "./html";
import { applicationPath, emblem } from "./sections";

const facet = (index: 1 | 2 | 3 | 4 | 5): string => `var(--facette-${index})`;

/** One drawing per moment, from the prototype (tools/recap.ts, `illustration`), 120 x 120. */
function momentDrawing(id: MomentId): string {
  const [f1, f2, f3, f4, f5] = [facet(1), facet(2), facet(3), facet(4), facet(5)];
  const body = {
    besoin: `<polygon points="24,12 78,12 96,30 96,108 24,108" fill="${f1}"/><polygon points="24,108 96,108 96,30" fill="${f2}" opacity="0.6"/><polygon points="78,12 96,30 78,30" fill="${f4}"/><rect x="36" y="42" width="40" height="6" rx="3" fill="${f4}"/><rect x="36" y="56" width="46" height="6" rx="3" fill="${f3}"/><rect x="36" y="70" width="28" height="6" rx="3" fill="${f3}"/><polygon points="66,98 102,62 112,72 76,108" fill="${f5}"/><polygon points="102,62 108,56 118,66 112,72" fill="${f3}"/><polygon points="66,98 76,108 62,112" fill="${f2}"/>`,
    construire: `<polygon points="60,8 106,32 60,56 14,32" fill="${f2}"/><polygon points="14,32 60,56 60,112 14,88" fill="${f3}"/><polygon points="60,56 106,32 106,88 60,112" fill="${f4}"/><polygon points="30,74 52,64 44,82" fill="${f1}"/><polygon points="44,82 52,64 56,76" fill="${f1}" opacity="0.7"/><polygon points="52,64 58,56 56,76" fill="${f1}" opacity="0.8"/><polyline points="14,32 60,56 106,32" fill="none" stroke="${f1}" stroke-width="2" opacity="0.7"/><line x1="60" y1="56" x2="60" y2="112" stroke="${f1}" stroke-width="2" opacity="0.5"/><polygon points="76,62 92,54 92,70 76,78" fill="${f5}"/><circle cx="84" cy="66" r="3" fill="${f1}"/>`,
    verifier: `<polygon points="60,8 100,22 96,64 60,112" fill="${f4}"/><polygon points="60,8 20,22 24,64 60,112" fill="${f3}"/><polygon points="60,8 100,22 60,38 20,22" fill="${f2}"/><polygon points="60,112 96,64 60,74 24,64" fill="${f5}" opacity="0.35"/><polyline points="40,60 55,75 82,46" fill="none" stroke="${f1}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
    signer: `<polygon points="40,78 54,82 46,116 34,106" fill="${f4}"/><polygon points="80,78 66,82 74,116 86,106" fill="${f5}"/>${seal(60, 50, 40, f2, f3)}<circle cx="60" cy="50" r="22" fill="${f4}"/><polygon points="60,36 64,46 75,46 66,53 69,64 60,57 51,64 54,53 45,46 56,46" fill="${f1}"/>`,
  }[id];
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${body}</svg>`;
}

/** An eight-pointed rosette of alternating facets, the seal of a signed delivery. */
function seal(cx: number, cy: number, r: number, odd: string, even: string): string {
  const points = Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  });
  return points
    .map((p, i) => {
      const q = points[(i + 1) % 8] ?? p;
      return `<polygon points="${cx},${cy} ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}" fill="${i % 2 ? odd : even}"/>`;
    })
    .join("");
}

/** A hand-drawn arrow, in the ink of the note it follows. */
const ARROW = `<svg class="fleche-main" viewBox="0 0 60 44" aria-hidden="true"><path d="M4 6 C 22 0, 44 10, 50 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M42 27 L50 34 L54 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The folded paper edge under the opening: the next section's paper, creased. */
const FOLD = `<svg class="pli-bas" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,60 0,34 180,8 420,46 640,4 880,40 1060,12 1200,30 1200,60" fill="var(--fond)"/><polygon points="180,8 420,46 300,60 0,60 0,34" fill="var(--encre)" opacity="0.06"/><polygon points="640,4 880,40 800,60 560,60" fill="var(--encre)" opacity="0.06"/><polygon points="1060,12 1200,30 1200,60 1120,60" fill="var(--encre)" opacity="0.04"/></svg>`;

function plate(): Html {
  const application = applicationOf(OPENING.plate.application);
  const universe = UNIVERSES.find((candidate) => candidate.id === application.universe);
  return h(
    "figure",
    { class: `planche univers-${application.universe}` },
    h("figcaption", { class: "note-main planche-titre" }, OPENING.plate.title),
    h("div", { class: "planche-feuille" }, emblem(application.ref)),
    h(
      "p",
      { class: "planche-nom" },
      h("a", { href: applicationPath(application) }, "Libre ", application.name),
      h("span", { class: "planche-univers" }, universe?.verb ?? ""),
    ),
    h("p", { class: "planche-promesse" }, application.promise),
  );
}

export function opening(): Html {
  return h(
    "section",
    { class: "ouverture", "aria-labelledby": "titre-accueil" },
    h(
      "div",
      { class: "largeur ouverture-grille" },
      h(
        "div",
        { class: "ouverture-texte" },
        h("h1", { id: "titre-accueil" }, OPENING.title),
        h("p", { class: "ouverture-sous" }, OPENING.subtitle),
        // The prototype's two calls lead to the trial and to the ways to start, which come with
        // their sections (lot 4 of the redesign); until then the call is the waitlist's.
        h(
          "p",
          { class: "actions" },
          h(
            "a",
            { class: "bouton bouton-nuit", href: "/rejoindre/" },
            "Rejoindre la liste d'attente",
          ),
        ),
      ),
      h(
        "div",
        { class: "ouverture-planche" },
        h("p", { class: "note-main ouverture-note" }, OPENING.note, raw(ARROW)),
        plate(),
      ),
    ),
    raw(FOLD),
  );
}

export function moments(): Html {
  return h(
    "section",
    { class: "bloc", id: "moments", "aria-labelledby": "titre-moments" },
    h(
      "div",
      { class: "largeur" },
      h("h2", { id: "titre-moments", class: "titre-moments" }, MOMENTS_TITLE),
      h(
        "ol",
        { class: "moments" },
        MOMENTS.map((moment) =>
          h(
            "li",
            { class: `moment univers-${moment.universe}` },
            h("div", { class: "moment-dessin" }, raw(momentDrawing(moment.id))),
            h("p", { class: "note-main moment-note" }, moment.note),
            h("h3", {}, moment.title),
            h("p", {}, moment.text),
          ),
        ),
      ),
    ),
  );
}
