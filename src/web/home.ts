/**
 * The opening and the four moments of the home page (ADR 0010 §8), drawn as the redesign
 * prototype judged in its version 17 draws them, at rest: the page is complete without script
 * (ADR 0005 §1), and the folding of the plate is a later enhancement (ADR 0010 §4).
 *
 * Drawings are faceted like the emblems and coloured only through the facet tokens of their
 * universe (`--facette-1` lit … `--facette-5` shadowed), set by its `univers-<id>` class.
 */
import { applicationOf } from "../content/applications";
import { DELIVERY, MOMENTS, MOMENTS_TITLE, type MomentId, OPENING } from "../content/home";
import { TRIAL_RULES } from "../content/trial";
import { UNIVERSES } from "../content/universes";
import { type Html, h, raw } from "./html";
import { foldingEmblem } from "./paper-fold";
import { applicationPath, emblem } from "./sections";
import { trialRulePictogram } from "./trial";

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
    h("div", { class: "planche-feuille", "data-papier": true }, foldingEmblem(application.ref)),
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
        h(
          "p",
          { class: "actions" },
          h("a", { class: "bouton bouton-nuit", href: OPENING.trial.href }, OPENING.trial.label),
          h(
            "a",
            { class: "bouton bouton-nuit-trait", href: "#commencer" },
            "Transformer mon entreprise",
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
type DeliveryPiece = (typeof DELIVERY.pieces)[number];

function deliveryIcon(icon: DeliveryPiece["icon"]): Html {
  if (icon === "rules") {
    return h(
      "span",
      { class: "livraison-regles", "aria-hidden": "true" },
      TRIAL_RULES.map((rule) => trialRulePictogram(rule, "regle-pic")),
    );
  }
  const [lit, mid, shade, dark] = [facet(1), facet(2), facet(3), facet(5)];
  const body = {
    request: `<path d="M16 8h34v48H16z" fill="${lit}"/><path d="M50 8v48H16z" fill="${mid}"/><path d="M22 19h21m-21 10h21m-21 10h14" fill="none" stroke="${dark}" stroke-width="4"/>`,
    code: `<path d="M12 6h30l10 10v42H12z" fill="${lit}"/><path d="M42 6l10 10H42z" fill="${shade}"/><path d="m27 26-8 8 8 8m10-16 8 8-8 8" fill="none" stroke="${dark}" stroke-width="4"/>`,
    record: `<path d="m22 42 8 3-6 15-7-4zm20 0-8 3 6 15 7-4z" fill="${shade}"/>${seal(32, 28, 22, mid, shade)}<circle cx="32" cy="28" r="12" fill="${dark}"/><path d="m26 28 5 5 8-10" fill="none" stroke="${lit}" stroke-width="4"/>`,
    guide: `<path d="M12 32h40v26H12z" fill="${lit}"/><path d="M6 34 32 8v26z" fill="${shade}"/><path d="M32 8l26 26H32zM27 42h10v16H27z" fill="${dark}"/>`,
    data: `<path d="m28 22 22 11-22 11L6 33z" fill="${lit}"/><path d="m6 33 22 11v18L6 51z" fill="${mid}"/><path d="M28 44l22-11v18L28 62z" fill="${shade}"/><path d="M38 4h22v22l-7-7-11 11-8-8 11-11z" fill="${dark}"/>`,
  }[icon];
  return raw(`<svg class="livraison-picto" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`);
}

function deliveryPieces(pieces: readonly DeliveryPiece[], side: "gauche" | "droite"): Html {
  return h(
    "ul",
    { class: `livraison-pieces livraison-${side}`, role: "list" },
    pieces.map((piece) =>
      h(
        "li",
        { class: "livraison-piece" },
        deliveryIcon(piece.icon),
        h("div", {}, h("h3", {}, piece.title), h("p", {}, piece.text)),
      ),
    ),
  );
}

export function explodedDelivery(): Html {
  const application = applicationOf(DELIVERY.application);
  const universe = UNIVERSES.find((candidate) => candidate.id === application.universe);
  const half = DELIVERY.pieces.length / 2;
  return h(
    "section",
    { class: "bloc livraison", id: "fabrication", "aria-labelledby": "titre-livraison" },
    h(
      "div",
      { class: "largeur" },
      h("h2", { id: "titre-livraison", class: "titre-section" }, DELIVERY.title),
      h("p", { class: "livraison-intro" }, DELIVERY.lead),
      h(
        "figure",
        { class: `livraison-plan univers-${application.universe}` },
        h(
          "figcaption",
          { class: "livraison-coeur" },
          h("span", { class: "livraison-tuile" }, emblem(application.ref)),
          h("strong", {}, application.name),
          h("span", {}, universe?.verb),
          h("span", { class: "illustration" }, "Illustration"),
          h(
            "button",
            {
              class: "bouton bouton-nuit-trait",
              type: "button",
              hidden: true,
              "data-ranger": true,
            },
            "Animer le rangement des pièces",
          ),
        ),
        deliveryPieces(DELIVERY.pieces.slice(0, half), "gauche"),
        deliveryPieces(DELIVERY.pieces.slice(half), "droite"),
      ),
    ),
  );
}
