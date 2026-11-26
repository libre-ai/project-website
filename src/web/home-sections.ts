import { APPLICATIONS, applicationOf } from "../content/applications";
import {
  COMPARISONS,
  PROOFS,
  QUESTIONS,
  STARTING_PATHS,
  UNIVERSE_DESCRIPTIONS,
} from "../content/home-sections";
import { UNIVERSES } from "../content/universes";
import { type Html, h, raw } from "./html";
import { applicationPath, emblem } from "./sections";

const ICON_PATHS = {
  cloud:
    "M5 38c0-7 5-12 12-12 2-8 8-12 16-12 9 0 15 6 16 14 7 0 11 5 11 11s-5 11-11 11H17C10 50 5 45 5 38Z",
  home: "m5 30 27-23 27 23M12 26v30h40V26M27 56V38h10v18",
  lock: "M12 28h40v29H12zM21 28V17a11 11 0 0 1 22 0v11M32 39v8",
  door: "M9 56h49M16 56V8h34v48M16 8l24 8v46l-24-6m16-18h1",
  box: "M8 17h48v30H8zM8 17l24 12 24-12M32 29v18",
  window: "M10 10h44v44H10zM32 10v44M10 32h44",
  speech: "M8 11h48v32H30L16 55V43H8zM18 22h28M18 31h18",
  seal: "M32 4a22 22 0 1 0 0 44 22 22 0 1 0 0-44ZM18 43l-5 17 11-5 7 5 2-12m13-5 5 17-11-5m-18-29 7 7 13-15",
  journal: "M14 8h39v48H14zM21 8v48M11 17h8m-8 10h8m-8 10h8m-8 10h8m9-28h17m-17 9h11",
  list: "M12 7h40v50H12zM19 24l4 4 7-9m5 6h10m-26 15 4 4 7-9m5 6h10",
  access: "M32 5a5 5 0 1 0 0 10 5 5 0 1 0 0-10ZM10 21l22 4 22-4M32 25v13m0 0L21 57m11-19 11 19",
  replay: "M50 22A21 21 0 1 0 51 42M50 10v14H36m-8-2 12 10-12 10z",
  export: "M30 12H9v44h46V34M29 35 55 9M41 9h14v14",
  fold: "M11 6h29l13 13v39H11zM40 6v13h13M20 31h24m-24 9h18",
  factory: "M6 56V29l16-10v10l16-10v10l16-10v37zM14 43h6m9 0h6m9 0h6",
} as const;

function icon(name: keyof typeof ICON_PATHS): Html {
  return raw(
    `<svg class="accueil-picto" viewBox="0 0 64 64" aria-hidden="true"><path d="${ICON_PATHS[name]}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  );
}

function section(id: string, title: string, ...children: Html[]): Html {
  const heading = `titre-${id}`;
  return h(
    "section",
    { id, class: "bloc accueil-suite", "aria-labelledby": heading },
    h(
      "div",
      { class: "largeur" },
      h("h2", { id: heading, class: "titre-section" }, title),
      children,
    ),
  );
}

export function comparison(): Html {
  return section(
    "parcours",
    "Ce qui change pour votre entreprise",
    h(
      "table",
      { class: "comparaison", "aria-labelledby": "titre-parcours" },
      h(
        "thead",
        {},
        h("tr", {}, h("th", { scope: "col" }, "Avant"), h("th", { scope: "col" }, "Après")),
      ),
      h(
        "tbody",
        {},
        COMPARISONS.map((item) =>
          h(
            "tr",
            { class: `univers-${item.universe}` },
            h("td", {}, icon(item.icons[0]), h("p", {}, item.before)),
            h("td", {}, icon(item.icons[1]), h("p", {}, item.after)),
          ),
        ),
      ),
    ),
  );
}

export function aviary(): Html {
  return section(
    "univers",
    "Commencez par une application",
    h(
      "p",
      {},
      "Une volée d'applications libres en préparation, pour huit familles d'usages. Explorez les fiches pour suivre leur avancement.",
    ),
    h(
      "ul",
      { class: "voliere", role: "list" },
      UNIVERSES.map((universe) => {
        const apps = APPLICATIONS.filter((application) => application.universe === universe.id);
        return h(
          "li",
          { class: `accueil-fiche univers-${universe.id}` },
          h("h3", {}, universe.verb),
          h("p", {}, UNIVERSE_DESCRIPTIONS[universe.id]),
          h(
            "ul",
            { class: "voliere-oiseaux", role: "list" },
            apps
              .slice(0, 3)
              .map((application) =>
                h(
                  "li",
                  {},
                  h(
                    "a",
                    { href: applicationPath(application) },
                    emblem(application.ref),
                    application.name,
                  ),
                ),
              ),
          ),
          apps.length > 3
            ? h(
                "p",
                {},
                "Et aussi : ",
                apps
                  .slice(3)
                  .map((application) => application.name)
                  .join(", "),
              )
            : null,
        );
      }),
    ),
    h("a", { class: "bouton", href: "/applications/" }, "Voir les applications"),
  );
}

export function proofs(): Html {
  return section(
    "preuves",
    "Ne nous croyez pas. Vérifiez.",
    h("p", {}, "Voici ce que la chaîne prévoit de rendre vérifiable pour une version."),
    h(
      "ul",
      { class: "preuves-accueil", role: "list" },
      PROOFS.map((proof) =>
        h(
          "li",
          { class: `accueil-fiche univers-${proof.universe}` },
          icon(proof.icon),
          h("div", {}, h("h3", {}, proof.title), h("p", {}, proof.text)),
        ),
      ),
    ),
    h("a", { class: "bouton", href: "/preuves/" }, "Consulter les preuves publiques"),
  );
}

export function questions(): Html {
  return section(
    "questions",
    "Les questions qu'on nous pose",
    h(
      "div",
      { class: "questions-accueil" },
      QUESTIONS.map(({ question, answer }) =>
        h("details", {}, h("summary", {}, question), h("p", {}, answer)),
      ),
    ),
  );
}

export function startingPaths(): Html {
  const first = applicationOf("P15");
  const drawings = [emblem(first.ref), icon("fold"), icon("factory")] as const;
  return section(
    "commencer",
    "De la première application à votre propre fabrique",
    h(
      "ol",
      { class: "chemins", role: "list" },
      STARTING_PATHS.map((path, index) =>
        h(
          "li",
          { class: "accueil-fiche" },
          h("div", { class: `chemin-dessin univers-${first.universe}` }, drawings[index] ?? null),
          h("h3", {}, path.title),
          h("p", {}, path.text),
          h("a", { href: path.href }, path.label),
        ),
      ),
    ),
    h("p", {}, "Chaque marche se garde. Rien ne vous enferme."),
  );
}

export function closing(): Html {
  return section(
    "rejoindre",
    "Préparez votre fabrique.",
    h(
      "p",
      {},
      "Suivez l'avancement des applications qui vous intéressent et choisissez si vous souhaitez participer aux premiers essais.",
    ),
    h("a", { class: "bouton", href: "/rejoindre/" }, "Rejoindre la liste d'attente"),
  );
}
