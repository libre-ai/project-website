/**
 * Content sections of the Libre IA pages (ADR 0007): application cards, universe tabs, journeys,
 * guided tour and layer explorer. Authored HTML from the accepted prototype (demos, result cards,
 * tour scenes) is hoisted with a fixed prefix per item, and `hoistedContentCss` hoists the same
 * items with the same prefixes, so every generated class has its rule in the stylesheet.
 */
import { emblemUse } from "../brand/sprite";
import { APPLICATIONS, type Application, applicationOf } from "../content/applications";
import { type Layer, layers, type TourStep, tour } from "../content/factory";
import { type Journey, journeys } from "../content/journeys";
import { refOfPrototypeKey } from "../content/prototype-keys";
import { showcaseOf } from "../content/showcases";
import { UNIVERSES } from "../content/universes";
import { hoistStyles } from "./hoist";
import { type Html, h, raw } from "./html";

const demoPrefix = (ref: string): string => ref.toLowerCase();
const journeyPrefix = (journey: Journey): string => `parcours-${journey.id}`;
const stepPrefix = (step: TourStep): string => `etape-${step.id}`;

export const applicationPath = (application: Application): string =>
  `/applications/${application.slug}/`;

export function emblem(ref: string): Html {
  return raw(emblemUse(ref));
}

export function demoFigure(ref: string, large = false): Html {
  const hoisted = hoistStyles(showcaseOf(ref).demo, demoPrefix(ref));
  return h(
    "figure",
    { class: large ? "demo demo-grande" : "demo", "aria-hidden": "true" },
    raw(hoisted.html),
    h("span", { class: "illustration" }, "Illustration"),
  );
}

export function appCard(application: Application): Html {
  const showcase = showcaseOf(application.ref);
  return h(
    "li",
    { class: `carte-application univers-${application.universe}` },
    h("span", { class: "fonction" }, showcase.category),
    demoFigure(application.ref),
    h(
      "div",
      { class: "corps-carte" },
      emblem(application.ref),
      h(
        "a",
        { class: "couvrir", href: applicationPath(application) },
        h("h3", {}, "Libre ", h("span", { class: "nom-libre" }, application.name)),
      ),
      h("p", {}, application.promise),
      h(
        "div",
        { class: "etiquettes" },
        showcase.tags.map((tag) => h("span", { class: "etiquette" }, tag)),
      ),
    ),
  );
}

export function universeTabs(): Html {
  return h(
    "div",
    { class: "univers-onglets", "data-onglets": true },
    h(
      "ul",
      { "data-onglets-liste": true },
      UNIVERSES.map((universe) => h("li", {}, h("a", { href: `#${universe.id}` }, universe.verb))),
    ),
    UNIVERSES.map((universe) =>
      h(
        "section",
        {
          id: universe.id,
          class: `univers-${universe.id}`,
          "aria-labelledby": `titre-${universe.id}`,
        },
        h("h3", { id: `titre-${universe.id}`, class: "titre-univers" }, universe.verb),
        h(
          "ul",
          { class: "cartes" },
          APPLICATIONS.filter((application) => application.universe === universe.id).map(appCard),
        ),
      ),
    ),
  );
}

function journeyPanel(journey: Journey): Html {
  const hoisted = hoistStyles(journey.card, journeyPrefix(journey));
  return h(
    "div",
    { class: "scene-parcours" },
    h(
      "ol",
      { class: "trajet" },
      journey.apps.map((key) => {
        const application = applicationOf(refOfPrototypeKey(key));
        return h(
          "li",
          { class: `univers-${application.universe}` },
          emblem(application.ref),
          h("span", {}, `Libre ${application.name}`),
        );
      }),
    ),
    h(
      "div",
      { class: "resultat" },
      h("span", { class: "illustration" }, "Illustration du résultat visé"),
      raw(hoisted.html),
    ),
    h(
      "div",
      { class: "gain" },
      h("p", { class: "obtenu" }, journey.result),
      h("p", { class: "confort" }, journey.comfort),
    ),
  );
}

export function journeyAccordion(): Html {
  return h(
    "div",
    { class: "parcours-grille" },
    journeys.map((journey, index) =>
      h(
        "details",
        { name: "parcours", open: index === 0 },
        h("summary", {}, journey.intent),
        journeyPanel(journey),
      ),
    ),
  );
}

// The prototype left this scene as a slot listing the birds of the application it builds.
function stepScene(step: TourStep): Html {
  const slot = /data-oiseaux="([^"]+)"/.exec(step.scene);
  if (slot?.[1] !== undefined) {
    return h(
      "div",
      { class: "constellation-app" },
      slot[1].split(" ").map((key) => {
        const application = applicationOf(refOfPrototypeKey(key));
        return h("span", { class: `univers-${application.universe}` }, emblem(application.ref));
      }),
    );
  }
  return raw(hoistStyles(step.scene, stepPrefix(step)).html);
}

// The tour names the application it builds; the name follows the data, never the prototype text.
function stepTitle(step: TourStep): string {
  return step.id === "application"
    ? `Libre ${applicationOf("P21").name} prend son envol`
    : step.title;
}

export function guidedTour(): Html {
  return h(
    "div",
    {
      class: "visite",
      "data-visite": true,
      "aria-label": "Suivre une demande, de l'intention au résultat",
    },
    h(
      "ol",
      { class: "visite-etapes" },
      tour.map((step, index) =>
        h(
          "li",
          { class: "visite-etape", id: `etape-${step.id}`, "data-etape": true },
          h(
            "div",
            {},
            h("span", { class: "numero" }, `Étape ${index + 1}`),
            h("h3", {}, stepTitle(step)),
            h("p", {}, step.lead),
          ),
          h("div", { class: "scene-etape" }, stepScene(step)),
        ),
      ),
    ),
  );
}

export function layerExplorer(): Html {
  return h(
    "div",
    { class: "explorateur", "data-couches": true },
    layers.map((layer: Layer) =>
      h(
        "details",
        { name: "couches", "data-couche": layer.id, "data-relie": layer.links.join(" ") },
        h("summary", {}, layer.name, h("small", {}, layer.question)),
        h("p", {}, layer.answer),
        h(
          "ul",
          { class: "meca" },
          layer.mechanisms.map((mechanism) => h("li", {}, mechanism)),
        ),
        h(
          "div",
          { class: "puces" },
          layer.tech.map((tech) => h("span", {}, tech)),
        ),
      ),
    ),
  );
}

/** The rules of every class the hoisting gives to authored content, in a fixed order. */
export function hoistedContentCss(): string {
  return [
    ...APPLICATIONS.map(
      (application) =>
        hoistStyles(showcaseOf(application.ref).demo, demoPrefix(application.ref)).css,
    ),
    ...journeys.map((journey) => hoistStyles(journey.card, journeyPrefix(journey)).css),
    ...tour.map((step) => hoistStyles(step.scene, stepPrefix(step)).css),
  ]
    .filter((css) => css !== "")
    .join("\n");
}
