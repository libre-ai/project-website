/**
 * The document shell of every Libre IA page: head, header with the martinet and the navigation,
 * main content, footer. The theme script is the first resource so a saved dark choice paints
 * before the first frame (ADR 0005); everything is served from the site (CSP of src/headers.ts).
 */

import { martinetUse } from "../brand/sprite";
import { SOCIAL_LABELS, SOCIALS, type SocialNetwork } from "../content/socials";
import { UNIVERSES } from "../content/universes";
import { logotype, themeToggle } from "./components";
import { type Html, h, raw, render } from "./html";

export interface PageFrame {
  readonly title: string;
  readonly description: string;
  /** Path of the page, used to mark the current section of the navigation. */
  readonly path: string;
  readonly main: Html;
  readonly noindex?: boolean;
}

const NAVIGATION: readonly (readonly [string, string])[] = [
  ["/#parcours", "Parcours"],
  ["/applications/", "Applications"],
  ["/fabrique/", "Comment c'est fait"],
  ["/a-propos/", "À propos"],
];

const UNDERSTAND: readonly (readonly [string, string])[] = [
  ["/#parcours", "Parcours"],
  ["/fabrique/", "Comment c'est fait"],
  ["/a-propos/", "À propos"],
  ["/preuves/", "Preuves"],
  ["/corrections/", "Corrections"],
  ["/licences/", "Licences"],
  ["/deployer/", "Déployer"],
  // FR-15: reporting an error is reachable from every page.
  ["/signaler/", "Signaler une erreur"],
  ["/confidentialite/", "Confidentialité"],
];

const isCurrent = (href: string, path: string): boolean =>
  !href.startsWith("/#") && (path === href || (href !== "/" && path.startsWith(href)));

function socialLinks(): Html[] {
  return (Object.keys(SOCIALS) as SocialNetwork[]).flatMap((network) => {
    const url = SOCIALS[network];
    return url === null ? [] : [h("li", {}, h("a", { href: url }, SOCIAL_LABELS[network]))];
  });
}

function header(path: string): Html {
  return h(
    "header",
    { class: "site-entete" },
    h(
      "div",
      { class: "largeur" },
      h("a", { class: "marque", href: "/" }, raw(martinetUse(null)), logotype()),
      h(
        "nav",
        { class: "site-navigation", "aria-label": "Principale" },
        h(
          "ul",
          {},
          NAVIGATION.map(([href, label]) =>
            h(
              "li",
              {},
              h("a", { href, "aria-current": isCurrent(href, path) ? "page" : null }, label),
            ),
          ),
        ),
      ),
      themeToggle(),
      h("a", { class: "appel-entete", href: "/rejoindre/" }, "Liste d'attente"),
    ),
  );
}

function footer(): Html {
  const column = (title: string, items: Html[]): Html =>
    h("div", {}, h("h2", {}, title), h("ul", {}, items));
  return h(
    "footer",
    { class: "site-pied" },
    h(
      "div",
      { class: "largeur" },
      h(
        "div",
        { class: "colonnes" },
        h(
          "div",
          {},
          h("a", { class: "marque", href: "/" }, raw(martinetUse(null)), logotype()),
          h("p", {}, "Ce que chacun réinvente seul, faisons-le ensemble."),
        ),
        column(
          "Les univers",
          UNIVERSES.map((universe) =>
            h("li", {}, h("a", { href: `/applications/#${universe.id}` }, universe.verb)),
          ),
        ),
        column(
          "Comprendre",
          UNDERSTAND.map(([href, label]) => h("li", {}, h("a", { href }, label))),
        ),
        column("Rejoindre", [
          h("li", {}, h("a", { href: "/rejoindre/" }, "Liste d'attente")),
          ...socialLinks(),
        ]),
      ),
      h(
        "p",
        { class: "pied-bas" },
        h("span", {}, "Libre IA, logiciels sous licences EUPL et Apache"),
        h("span", {}, "Les visuels montrent le résultat visé : ce sont des illustrations."),
      ),
    ),
  );
}

export function layout(page: PageFrame): string {
  const head = h(
    "head",
    {},
    h("meta", { charset: "utf-8" }),
    h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
    h("title", {}, page.title),
    h("meta", { name: "description", content: page.description }),
    page.noindex === true ? h("meta", { name: "robots", content: "noindex" }) : null,
    h("link", { rel: "icon", href: "/assets/martinet.svg", type: "image/svg+xml" }),
    h("script", { src: "/assets/theme-init.js" }),
    h("link", { rel: "stylesheet", href: "/assets/site.css" }),
    h("script", { src: "/assets/main.js", type: "module" }),
  );
  const body = h(
    "body",
    {},
    h("a", { class: "evitement", href: "#contenu" }, "Aller au contenu"),
    header(page.path),
    h("main", { id: "contenu" }, page.main),
    footer(),
  );
  return `<!doctype html>\n<html lang="fr">\n${render(head)}\n${render(body)}\n</html>\n`;
}
