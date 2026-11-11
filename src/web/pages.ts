/**
 * Pages of the Libre IA site (ADR 0007). Copy comes from the prototype accepted on 2026-11-09.
 * The first screen is « Chacun seul / Ensemble » (owner decision 13), made of two radio buttons
 * so it works without script; the module plays it as a view transition (ADR 0005).
 */
import { APPLICATIONS, type Application, applicationOf } from "../content/applications";
import { commons, journeys, pillars } from "../content/journeys";
import { refOfPrototypeKey } from "../content/prototype-keys";
import { showcaseOf } from "../content/showcases";
import { SOCIAL_LABELS, SOCIALS, type SocialNetwork } from "../content/socials";
import { UNIVERSES } from "../content/universes";
import { waitlistForm } from "./components";
import { type Html, h, raw } from "./html";
import {
  applicationPath,
  demoFigure,
  emblem,
  guidedTour,
  journeyAccordion,
  layerExplorer,
  universeTabs,
} from "./sections";

const heading = (overline: string, title: string, lead: string | null, id?: string): Html =>
  h(
    "div",
    { class: "bloc-tete" },
    h("p", { class: "surtitre" }, overline),
    h("h2", id === undefined ? {} : { id }, title),
    lead === null ? null : h("p", {}, lead),
  );

const block = (id: string, ...children: Html[]): Html =>
  h("section", { class: "bloc", id }, h("div", { class: "largeur" }, children));

// Each silo of « chacun seul » has its Libre counterpart in « ensemble », pairwise, so the view
// transition can morph one into the other.
const SILOS: readonly (readonly [string, string, string])[] = [
  ["Agenda", "abonnement n°1", "P19"],
  ["Notes", "un silo de plus", "P04"],
  ["Tableur", "copie maison", "P09"],
  ["Visio", "un compte de plus", "P18"],
  ["Sauvegarde", "jamais testée", "P38"],
  ["Assistant IA", "lit vos données", "P34"],
];

function soloTogether(): Html {
  return h(
    "section",
    { class: "hero-seul-ensemble", "data-seul-ensemble": true, "aria-labelledby": "titre-accueil" },
    h(
      "div",
      { class: "largeur" },
      h(
        "div",
        { class: "entete" },
        h(
          "h1",
          { id: "titre-accueil" },
          "Seul, ou ",
          h("span", { class: "degrade" }, "ensemble"),
          " ?",
        ),
        h(
          "p",
          { class: "sous" },
          "Ce que chacun réinvente seul, faisons-le ensemble. Décrivez un besoin, la fabrique le construit, tout le monde en profite.",
        ),
      ),
      h(
        "fieldset",
        { class: "bascule-avancer" },
        h("legend", {}, "Comment voulez-vous avancer ?"),
        h(
          "label",
          {},
          h("input", {
            type: "radio",
            name: "avancer",
            value: "seul",
            id: "avancer-seul",
            checked: true,
          }),
          " Chacun seul",
        ),
        h(
          "label",
          {},
          h("input", { type: "radio", name: "avancer", value: "ensemble", id: "avancer-ensemble" }),
          " Ensemble",
        ),
      ),
      h(
        "div",
        { class: "scene-avancer" },
        h(
          "ul",
          { class: "cote-seul", "aria-label": "Chacun seul" },
          SILOS.map(([tool, cost], index) =>
            h("li", { class: `silo vol-${index + 1}` }, h("b", {}, tool), cost),
          ),
        ),
        h(
          "ul",
          { class: "cote-ensemble", "aria-label": "Ensemble" },
          SILOS.map(([, , ref], index) => {
            const application = applicationOf(ref);
            return h(
              "li",
              { class: `envol vol-${index + 1} univers-${application.universe}` },
              emblem(ref),
              h("span", {}, `Libre ${application.name}`),
            );
          }),
        ),
      ),
      h("p", { class: "devise" }, "Vos outils. Vos données. Votre IA."),
      h(
        "div",
        { class: "actions" },
        h(
          "a",
          { class: "bouton bouton-aube", href: "/rejoindre/" },
          "Rejoindre la liste d'attente",
        ),
        h("a", { class: "bouton bouton-trait", href: "#fabrique-commun" }, "Comment ça marche"),
      ),
    ),
  );
}

function threeSteps(): Html {
  const agenda = applicationOf("P19");
  return block(
    "fabrique-commun",
    heading(
      "La fabrique en commun",
      "Décrivez un besoin. La fabrique le construit. Tout le monde en profite.",
      "Au lieu de mille équipes qui réinventent chacune le même outil, une seule fabrique, ouverte, où des agents construisent sous garanties ce dont chacun a besoin. Chaque outil construit devient un commun.",
    ),
    h(
      "ol",
      { class: "trois-temps" },
      h(
        "li",
        { class: "temps" },
        h(
          "div",
          { class: "visuel" },
          h("span", { class: "bulle" }, "« Un agenda qui ne me piste pas. »"),
        ),
        h("h3", {}, "Vous décrivez un besoin"),
        h(
          "p",
          {},
          "En une phrase. Avant le code, la fabrique écrit avec vous ce que « réussi » veut dire.",
        ),
      ),
      h(
        "li",
        { class: `temps univers-${agenda.universe}` },
        h("div", { class: "visuel" }, emblem(agenda.ref)),
        h("h3", {}, "La fabrique le construit"),
        h(
          "p",
          {},
          "Des agents IA, encadrés par des garde-fous qu'ils ne peuvent pas contourner, relus et prouvés.",
        ),
      ),
      h(
        "li",
        { class: `temps temps-commun univers-${agenda.universe}` },
        h("div", { class: "visuel" }, emblem(agenda.ref)),
        h("h3", {}, "Tout le monde en profite"),
        h(
          "p",
          {},
          "L'outil est libre, chez vous, et sert désormais tous ceux qui avaient le même besoin.",
        ),
      ),
    ),
  );
}

function socials(): Html {
  const links = (Object.keys(SOCIALS) as SocialNetwork[]).flatMap((network) => {
    const url = SOCIALS[network];
    return url === null ? [] : [h("li", {}, h("a", { href: url }, SOCIAL_LABELS[network]))];
  });
  return h("ul", { class: "reseaux" }, links);
}

function join(follow: Application | null, idSuffix: string): Html {
  return h(
    "div",
    { class: "rejoindre-grille" },
    h(
      "div",
      { id: "liste-attente" },
      h(
        "h2",
        {},
        follow === null
          ? "Rejoignez la première volée."
          : `Libre ${follow.name}, parmi les premiers.`,
      ),
      h(
        "p",
        {},
        follow === null
          ? "Soyez prévenu quand une application prend son envol, et testez-la avant tout le monde si vous le souhaitez."
          : "Rejoignez la liste d'attente : vous serez prévenu quand elle prend son envol, et invité à la tester si vous le souhaitez.",
      ),
      waitlistForm({
        follow: follow === null ? null : { ref: follow.ref, name: `Libre ${follow.name}` },
        idSuffix,
      }),
    ),
    h("div", {}, h("h2", {}, "Suivre la fabrique"), socials()),
  );
}

export function homeMain(): Html {
  return h(
    "div",
    {},
    soloTogether(),
    threeSteps(),
    block(
      "parcours",
      heading(
        "Parcours",
        "Je veux…",
        "Choisissez ce que vous voulez accomplir : les applications Libre s'enchaînent, et vous obtenez le résultat.",
      ),
      journeyAccordion(),
    ),
    block(
      "univers",
      heading(
        "Les univers",
        "Une volée d'applications, nées de la même fabrique.",
        "Chacune règle un besoin pour de bon, et toutes se parlent. Choisissez un univers et regardez-les travailler.",
      ),
      universeTabs(),
    ),
    block(
      "fabrication",
      heading(
        "Comment c'est fait",
        "Suivez une demande, de l'intention au résultat.",
        "Une visite guidée en sept étapes : la fabrique, ses garde-fous et ses briques, au travail sur un besoin réel.",
      ),
      guidedTour(),
      h(
        "p",
        { class: "actions" },
        h("a", { class: "bouton bouton-trait", href: "/fabrique/" }, "Explorer toutes les couches"),
      ),
    ),
    block(
      "commun",
      h("h2", {}, "Un seul effort partagé plutôt que mille copies du même besoin."),
      h(
        "ul",
        { class: "engagements" },
        commons.map((item) => h("li", {}, h("h3", {}, item.title), h("p", {}, item.text))),
      ),
    ),
    block("rejoindre", join(null, "accueil")),
  );
}

export function applicationsMain(): Html {
  return block(
    "toutes-les-applications",
    h("h1", {}, "Les applications Libre"),
    h(
      "p",
      { class: "chapeau" },
      "Nées de la même fabrique, rangées par ce qu'elles vous permettent de faire. Rejoignez la liste d'attente de celles que vous attendez.",
    ),
    universeTabs(),
  );
}

export function applicationMain(application: Application): Html {
  const showcase = showcaseOf(application.ref);
  const universe = UNIVERSES.find((item) => item.id === application.universe);
  const related = journeys.filter((journey) =>
    journey.apps.some((key) => refOfPrototypeKey(key) === application.ref),
  );
  const siblings = APPLICATIONS.filter(
    (other) => other.universe === application.universe && other.ref !== application.ref,
  );
  return h(
    "div",
    { class: `univers-${application.universe}` },
    h(
      "section",
      { class: "app-hero" },
      h(
        "div",
        { class: "largeur app-hero-grille" },
        h(
          "div",
          {},
          h(
            "p",
            { class: "fil" },
            h("a", { href: "/applications/" }, "Applications"),
            " / ",
            h("a", { href: `/applications/#${application.universe}` }, universe?.verb ?? ""),
          ),
          h("span", { class: "embleme-grand" }, emblem(application.ref)),
          h("p", { class: "fonction-grande" }, showcase.category),
          h("h1", {}, "Libre ", h("span", { class: "nom-libre" }, application.name)),
          h("p", { class: "promesse" }, application.promise),
          h(
            "div",
            { class: "etiquettes" },
            showcase.tags.map((tag) => h("span", { class: "etiquette" }, tag)),
          ),
        ),
        demoFigure(application.ref, true),
      ),
    ),
    related.length === 0
      ? null
      : block(
          "ce-quelle-apporte",
          heading("Ce qu'elle vous apporte", "Ce qu'elle vous permet d'obtenir.", null),
          h(
            "ul",
            { class: "obtenus" },
            related.map((journey) =>
              h("li", {}, h("h3", {}, journey.intent), h("p", {}, journey.result)),
            ),
          ),
        ),
    block("rejoindre", join(application, application.ref.toLowerCase())),
    siblings.length === 0
      ? null
      : block(
          "meme-univers",
          heading(universe?.verb ?? "", "Dans le même univers.", null),
          h(
            "ul",
            { class: "voisines" },
            siblings.map((other) =>
              h(
                "li",
                { class: `univers-${other.universe}` },
                h("a", { href: applicationPath(other) }, emblem(other.ref), `Libre ${other.name}`),
              ),
            ),
          ),
        ),
  );
}

export function factoryMain(briques: Html): Html {
  return h(
    "div",
    {},
    block(
      "couches",
      h("h1", {}, "Comment c'est fait"),
      h(
        "p",
        { class: "chapeau" },
        "La fabrique, couche par couche. Ouvrez une couche : celles auxquelles elle est reliée s'éclairent.",
      ),
      layerExplorer(),
    ),
    block(
      "visite",
      heading("Visite guidée", "Suivez une demande, de l'intention au résultat.", null),
      guidedTour(),
    ),
    block(
      "briques",
      heading(
        "Les briques",
        "Les dépôts de la forge.",
        "Chaque brique est un dépôt public : son état et son avancement se lisent sur la forge, pas ici.",
      ),
      briques,
    ),
  );
}

export function joinMain(): Html {
  return block("rejoindre", h("h1", {}, "Rejoindre"), join(null, "rejoindre"));
}

export function aboutMain(): Html {
  return h(
    "div",
    {},
    block(
      "a-propos",
      h("h1", {}, "À propos"),
      h(
        "p",
        { class: "chapeau" },
        "Libre IA est une fabrique en commun : des outils libres, construits une fois sous garanties vérifiables, et partagés par tous.",
      ),
      h(
        "ul",
        { class: "engagements" },
        pillars.map((item) => h("li", {}, h("h3", {}, item.title), h("p", {}, item.text))),
      ),
    ),
    block(
      "gouvernance",
      h("h2", {}, "Gouvernance et contribution"),
      h(
        "p",
        {},
        "Chaque décision est écrite, datée et publique dans le dépôt de gouvernance. Les propositions passent par la forge publique, ouverte à toutes et à tous.",
      ),
      h(
        "ul",
        { class: "liens-forge" },
        h(
          "li",
          {},
          h(
            "a",
            { href: "https://github.com/libre-ai/project-governance" },
            "Le dépôt de gouvernance",
          ),
        ),
        h("li", {}, h("a", { href: "https://github.com/libre-ai" }, "La forge publique")),
        h("li", {}, h("a", { href: "/preuves/" }, "Les preuves")),
        h("li", {}, h("a", { href: "/licences/" }, "Les licences")),
        h("li", {}, h("a", { href: "/deployer/" }, "Déployer chez vous")),
      ),
    ),
  );
}

export function privacyMain(): Html {
  return block(
    "confidentialite",
    h("h1", {}, "Confidentialité"),
    h("h2", {}, "La liste d'attente"),
    h(
      "p",
      {},
      "Si vous rejoignez la liste d'attente, nous conservons votre adresse e-mail, la date de votre demande, la version du texte de consentement accepté et, si vous les indiquez, les univers qui vous intéressent, l'application que vous suivez et votre souhait de tester. Rien d'autre.",
    ),
    h(
      "p",
      {},
      "Un e-mail de confirmation vous est envoyé. Sans confirmation sous 48 heures, votre demande est effacée. Chaque message contient un lien de désinscription en un clic ; la désinscription efface votre adresse.",
    ),
    h(
      "p",
      {},
      "Votre adresse sert uniquement à vous prévenir des envols de Libre IA. Elle n'est ni vendue, ni partagée, ni utilisée pour de la publicité. Nos journaux techniques ne contiennent ni adresse e-mail, ni adresse IP.",
    ),
    h("h2", {}, "Le site"),
    h(
      "p",
      {},
      "Le site ne dépose aucun cookie et ne mesure pas votre audience. Il ne charge rien depuis un autre site. Votre choix de thème clair ou sombre reste dans votre navigateur.",
    ),
  );
}

const SUBSCRIPTION_PAGES = {
  merci: [
    "Vérifiez votre boîte de réception",
    "Si l'adresse est valide, un e-mail de confirmation part dans les minutes qui viennent. Ouvrez son lien dans les 48 heures pour rejoindre la liste. Rien reçu, même dans les indésirables ? Refaites la demande depuis la page Rejoindre.",
  ],
  confirmee: ["Inscription confirmée", "Merci : vous serez prévenu des envols de Libre IA."],
  desinscrit: [
    "Désinscription prise en compte",
    "Votre adresse a été effacée de la liste d'attente.",
  ],
  "lien-invalide": [
    "Lien expiré ou déjà utilisé",
    "Ce lien n'est plus valable. Vous pouvez refaire une demande depuis la page Rejoindre.",
  ],
  erreur: [
    "La demande n'a pas abouti",
    "L'adresse ou un des choix du formulaire n'a pas été reconnu. Vous pouvez réessayer depuis la page Rejoindre.",
  ],
} as const;

export type SubscriptionPage = keyof typeof SUBSCRIPTION_PAGES;
export const SUBSCRIPTION_PAGE_NAMES = Object.keys(SUBSCRIPTION_PAGES) as SubscriptionPage[];

export function subscriptionMain(page: SubscriptionPage): Html {
  const [title, text] = SUBSCRIPTION_PAGES[page];
  return block(
    "inscription",
    h("h1", {}, title),
    h("p", {}, text),
    h(
      "p",
      {},
      h("a", { href: "/rejoindre/" }, "Rejoindre"),
      " · ",
      h("a", { href: "/" }, "Accueil"),
    ),
  );
}

export function notFoundMain(): Html {
  return block(
    "introuvable",
    h("h1", {}, "Page introuvable"),
    h(
      "p",
      {},
      "Cette adresse ne mène nulle part. ",
      h("a", { href: "/" }, "Retour à l'accueil"),
      ".",
    ),
  );
}

/** A forge page whose body comes, already escaped, from the existing page modules. */
export function forgeMain(body: string): Html {
  return block("forge", raw(body));
}
