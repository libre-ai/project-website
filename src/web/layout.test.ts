import { describe, expect, test } from "bun:test";

import { CONSENT_TEXT } from "../content/consent";
import { UNIVERSES } from "../content/universes";
import { waitlistForm } from "./components";
import { h, render } from "./html";
import { layout } from "./layout";

const page = layout({
  title: "Applications, Libre IA",
  description: "Les applications Libre.",
  path: "/applications/",
  main: h("h1", {}, "Applications"),
});

describe("page layout", () => {
  test("is a French document with one main landmark and a skip link to it", () => {
    expect(page.startsWith('<!doctype html>\n<html lang="fr">')).toBe(true);
    expect(page.match(/<main\b/g)).toHaveLength(1);
    expect(page).toContain('<main id="contenu">');
    expect(page).toContain('href="#contenu"');
  });

  test("loads the theme script before the stylesheet, then the module, all from the site", () => {
    const theme = page.indexOf('src="/assets/theme-init.js"');
    const sheet = page.indexOf('href="/assets/site.css"');
    const module = page.indexOf('src="/assets/main.js"');
    expect(theme).toBeGreaterThan(-1);
    expect(theme).toBeLessThan(sheet);
    expect(sheet).toBeLessThan(module);
    expect(page).not.toMatch(/(src|href)="(https?:)?\/\/(?!github\.com)/);
  });

  test("marks the current section of the navigation", () => {
    expect(page).toContain('<a href="/applications/" aria-current="page">Applications</a>');
    expect(page.match(/aria-current="page"/g)).toHaveLength(1);
  });

  test("the theme toggle is hidden without script and carries an accessible name and state", () => {
    expect(page).toMatch(
      /<button type="button" class="bascule-theme" data-theme-toggle hidden aria-pressed="false">/,
    );
    expect(page).toContain("Thème sombre");
  });

  test("the footer shows only the networks that have an address", () => {
    expect(page).toContain('href="https://github.com/libre-ai"');
    expect(page).not.toMatch(/Discord|LinkedIn/);
  });

  test("the footer lists every universe", () => {
    for (const universe of UNIVERSES)
      expect(page).toContain(`href="/applications/#${universe.id}"`);
  });

  test("a page can ask not to be indexed", () => {
    const hidden = layout({
      title: "Merci",
      description: "x",
      path: "/inscription/merci/",
      main: h("h1", {}, "Merci"),
      noindex: true,
    });
    expect(hidden).toContain('<meta name="robots" content="noindex">');
    expect(page).not.toContain("noindex");
  });

  test("carries no inline style and no inline script", () => {
    expect(page).not.toMatch(/\sstyle=|<style|<script(?![^>]*\ssrc=)/);
  });
});

describe("waitlist form (ADR 0006)", () => {
  const general = render(waitlistForm({ follow: null, idSuffix: "accueil" }));
  const follow = render(
    waitlistForm({ follow: { ref: "P07", name: "Libre Révision" }, idSuffix: "p07" }),
  );

  test("posts to /inscription with a labelled, required email field", () => {
    expect(general).toContain(
      '<form class="formulaire-attente" method="post" action="/inscription">',
    );
    expect(general).toContain('<label for="courriel-accueil">Votre adresse e-mail</label>');
    expect(general).toMatch(
      /<input id="courriel-accueil" name="courriel" type="email" autocomplete="email" required>/,
    );
  });

  test("offers the universes as interests when no application is followed", () => {
    for (const universe of UNIVERSES)
      expect(general).toContain(`name="univers" value="${universe.id}"`);
    expect(general).not.toContain('name="suivre"');
  });

  test("follows one application by its reference, without the universe choice", () => {
    expect(follow).toContain('<input type="hidden" name="suivre" value="P07">');
    expect(follow).not.toContain('name="univers"');
    expect(follow).toContain("Libre Révision");
  });

  test("hides a honeypot from people and from the keyboard", () => {
    expect(general).toMatch(
      /<div class="piege" aria-hidden="true">.*name="site" tabindex="-1" autocomplete="off"/s,
    );
  });

  test("states the versioned consent text and links to the privacy page", () => {
    expect(general).toContain(CONSENT_TEXT.slice(0, 40));
    expect(general).toContain('href="/confidentialite/"');
    expect(general).toContain('name="testeur" value="oui"');
  });
});
