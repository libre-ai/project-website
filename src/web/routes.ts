/**
 * The route table of the Libre IA site (plan, Task 7): every generated page, its output file,
 * title, description and kind. Forge pages arrive already rendered, so this table depends on no
 * card or licence type. Subscription and error pages are `noindex` and stay out of the sitemap.
 */
import { APPLICATIONS } from "../content/applications";
import { type Html, h } from "./html";
import { layout } from "./layout";
import {
  aboutMain,
  applicationMain,
  applicationsMain,
  factoryMain,
  forgeMain,
  homeMain,
  joinMain,
  notFoundMain,
  privacyMain,
  SUBSCRIPTION_PAGE_NAMES,
  subscriptionMain,
} from "./pages";
import { applicationPath } from "./sections";

export interface ForgeBrick {
  readonly project: string;
  readonly title: string;
  readonly lead: string;
  readonly body: string;
}

export interface ForgeInput {
  readonly bricks: readonly ForgeBrick[];
  readonly proofs: string;
  readonly licences: string;
  readonly deploy: string;
  readonly signal: string;
  readonly corrections: string;
}

export type RouteKind = "page" | "forge" | "subscription" | "error";

export interface Route {
  readonly path: string;
  readonly file: string;
  readonly kind: RouteKind;
  readonly title: string;
  readonly description: string;
  readonly main: () => Html;
}

const SITE = "Libre IA";
const PROMISE = "Ce que chacun réinvente seul, faisons-le ensemble.";

export function fileOf(path: string): string {
  if (path === "/") return "index.html";
  if (path.endsWith("/")) return `${path.slice(1)}index.html`;
  return path.slice(1);
}

const route = (
  path: string,
  kind: RouteKind,
  title: string,
  description: string,
  main: () => Html,
): Route => ({ path, file: fileOf(path), kind, title, description, main });

export const brickPath = (project: string): string => `/fabrique/briques/${project}/`;

function bricksList(bricks: readonly ForgeBrick[]): Html {
  return h(
    "ul",
    { class: "briques" },
    bricks.map((brick) =>
      h(
        "li",
        {},
        h("a", { href: brickPath(brick.project) }, brick.title),
        " ",
        h("span", {}, brick.lead),
      ),
    ),
  );
}

export function libreRoutes(forge: ForgeInput): readonly Route[] {
  return [
    route("/", "page", `${SITE}, ${PROMISE.toLowerCase().replace(/\.$/, "")}`, PROMISE, homeMain),
    route(
      "/applications/",
      "page",
      `Les applications, ${SITE}`,
      "Les applications Libre, rangées par ce qu'elles vous permettent de faire.",
      applicationsMain,
    ),
    ...APPLICATIONS.map((application) =>
      route(
        applicationPath(application),
        "page",
        `Libre ${application.name}, ${SITE}`,
        application.promise,
        () => applicationMain(application),
      ),
    ),
    route(
      "/fabrique/",
      "page",
      `Comment c'est fait, ${SITE}`,
      "La fabrique couche par couche, une demande suivie de l'intention au résultat, et les briques de la forge.",
      () => factoryMain(bricksList(forge.bricks)),
    ),
    ...forge.bricks.map((brick) =>
      route(brickPath(brick.project), "forge", `${brick.title}, ${SITE}`, brick.lead, () =>
        forgeMain(brick.body),
      ),
    ),
    route(
      "/rejoindre/",
      "page",
      `Rejoindre, ${SITE}`,
      "Rejoindre la liste d'attente de Libre IA et suivre la fabrique.",
      joinMain,
    ),
    route(
      "/a-propos/",
      "page",
      `À propos, ${SITE}`,
      "Une fabrique en commun, gouvernée à découvert.",
      aboutMain,
    ),
    route(
      "/confidentialite/",
      "page",
      `Confidentialité, ${SITE}`,
      "Ce que Libre IA conserve, pourquoi, et comment l'effacer.",
      privacyMain,
    ),
    route(
      "/preuves/",
      "forge",
      `Preuves, ${SITE}`,
      "Chaque garantie et la commande qui la rejoue.",
      () => forgeMain(forge.proofs),
    ),
    route(
      "/corrections/",
      "forge",
      `Corrections, ${SITE}`,
      "Le journal daté des corrections.",
      () => forgeMain(forge.corrections),
    ),
    route(
      "/licences/",
      "forge",
      `Licences, ${SITE}`,
      "Les licences déclarées de chaque dépôt.",
      () => forgeMain(forge.licences),
    ),
    route("/deployer/", "forge", `Déployer, ${SITE}`, "Installer la fabrique chez vous.", () =>
      forgeMain(forge.deploy),
    ),
    route("/signaler/", "forge", `Signaler, ${SITE}`, "Signaler une erreur sur le site.", () =>
      forgeMain(forge.signal),
    ),
    ...SUBSCRIPTION_PAGE_NAMES.map((name) =>
      route(
        `/inscription/${name}/`,
        "subscription",
        `Liste d'attente, ${SITE}`,
        "Liste d'attente de Libre IA.",
        () => subscriptionMain(name),
      ),
    ),
    route(
      "/404.html",
      "error",
      `Page introuvable, ${SITE}`,
      "Cette adresse ne mène nulle part.",
      notFoundMain,
    ),
  ];
}

export function renderRoute(entry: Route): string {
  return layout({
    title: entry.title,
    description: entry.description,
    path: entry.path,
    main: entry.main(),
    noindex: entry.kind === "subscription" || entry.kind === "error",
  });
}
