/**
 * Shared components of the Libre IA pages. Every component is built with `h`, so none can carry
 * an inline style, an event handler or an unescaped text (ADR 0005).
 */
import { CONSENT_TEXT } from "../content/consent";
import { UNIVERSES } from "../content/universes";
import { type Html, h, raw } from "./html";

// Sun and moon, drawn in the button's current colour; the script swaps which one shows.
const SUN =
  '<svg class="icone-soleil" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const MOON =
  '<svg class="icone-lune" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" fill="currentColor"/></svg>';

/** Hidden without script: the module reveals it and keeps `aria-pressed` in step with the theme. */
export function themeToggle(): Html {
  return h(
    "button",
    {
      type: "button",
      class: "bascule-theme",
      "data-theme-toggle": true,
      hidden: true,
      "aria-pressed": "false",
    },
    raw(SUN),
    raw(MOON),
    h("span", { class: "visually-hidden" }, "Thème sombre"),
  );
}

/** « libre·ia », the dots of the two i replaced by the martinet's pixels (ADR 0004 §1). */
export function logotype(): Html {
  return h(
    "span",
    { class: "logotype" },
    h(
      "span",
      { "aria-hidden": "true" },
      "l",
      h("span", { class: "i" }, "ı"),
      "bre",
      h("span", { class: "point-median" }),
      h("span", { class: "i" }, "ı"),
      "a",
    ),
    h("span", { class: "visually-hidden" }, "Libre IA"),
  );
}

export interface FollowedApplication {
  readonly ref: string;
  readonly name: string;
}

export function waitlistForm(options: {
  readonly follow: FollowedApplication | null;
  readonly idSuffix: string;
}): Html {
  const id = (name: string): string => `${name}-${options.idSuffix}`;
  const interests =
    options.follow === null
      ? h(
          "fieldset",
          {},
          h("legend", {}, "Ce qui vous intéresse"),
          h(
            "div",
            { class: "choix" },
            UNIVERSES.map((universe) =>
              h(
                "label",
                {},
                h("input", { type: "checkbox", name: "univers", value: universe.id }),
                ` ${universe.verb}`,
              ),
            ),
          ),
        )
      : h("input", { type: "hidden", name: "suivre", value: options.follow.ref });
  return h(
    "form",
    { class: "formulaire-attente", method: "post", action: "/inscription" },
    options.follow === null
      ? null
      : h("p", { class: "suivi" }, `Vous suivez ${options.follow.name}.`),
    h("label", { for: id("courriel") }, "Votre adresse e-mail"),
    h(
      "div",
      { class: "champ" },
      h("input", {
        id: id("courriel"),
        name: "courriel",
        type: "email",
        autocomplete: "email",
        required: true,
      }),
      h("button", { type: "submit" }, "Rejoindre la liste"),
    ),
    interests,
    h(
      "label",
      { class: "case" },
      h("input", { type: "checkbox", name: "testeur", value: "oui" }),
      " Je veux tester en avant-première.",
    ),
    // A field people never see nor reach with the keyboard; robots fill it (ADR 0006 §5).
    h(
      "div",
      { class: "piege", "aria-hidden": "true" },
      h(
        "label",
        {},
        "Ne pas remplir ",
        h("input", { name: "site", tabindex: "-1", autocomplete: "off" }),
      ),
    ),
    h(
      "p",
      { class: "mention" },
      CONSENT_TEXT,
      " ",
      h("a", { href: "/confidentialite/" }, "Confidentialité"),
    ),
  );
}
