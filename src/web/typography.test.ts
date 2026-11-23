import { describe, expect, test } from "bun:test";

import { typeset } from "./typography";

const NBSP = "\u00a0";

describe("French no-break spaces (typeset)", () => {
  test("binds each high punctuation sign to the word before it", () => {
    expect(typeset("<p>Pourquoi : répond ; vraiment ? oui !</p>").html).toBe(
      `<p>Pourquoi${NBSP}: répond${NBSP}; vraiment${NBSP}? oui${NBSP}!</p>`,
    );
  });

  test("binds guillemets to the words they enclose", () => {
    expect(typeset("<p>« Ajouter les chiffres ? »</p>").html).toBe(
      `<p>«${NBSP}Ajouter les chiffres${NBSP}?${NBSP}»</p>`,
    );
  });

  test("collapses a run of source whitespace into one no-break space", () => {
    expect(typeset("<p>Décision\n    : lancer</p>").html).toBe(`<p>Décision${NBSP}: lancer</p>`);
  });

  test("crosses an inline element, as in the home title", () => {
    expect(typeset('<h1>Seul, ou <span class="degrade">ensemble</span> ?</h1>').html).toBe(
      `<h1>Seul, ou <span class="degrade">ensemble</span>${NBSP}?</h1>`,
    );
    expect(typeset("<p>«<b> mot</b> »</p>").html).toBe(`<p>«<b>${NBSP}mot</b>${NBSP}»</p>`);
  });

  test("never puts a no-break space at the start of a block", () => {
    expect(typeset("<p>mot</p>\n<p> : suite</p>").html).toBe("<p>mot</p>\n<p> : suite</p>");
  });

  test("leaves code, scripts, styles and comments untouched", () => {
    const untouched = [
      "<code>a ? b : c</code>",
      "<pre>x ; y</pre>",
      "<kbd>Ctrl : C</kbd>",
      "<samp>ok !</samp>",
      "<textarea>a : b</textarea>",
      '<script src="/a.js"> ; </script>',
      "<style>a { b : c }</style>",
      "<!-- a : b -->",
    ];
    for (const html of untouched) expect(typeset(html)).toEqual({ html, replaced: 0 });
  });

  test("leaves a sign glued to its word, or with nothing before it, as it is", () => {
    const untouched = ["<p>14:30, https://x, a;b</p>", "<p>: seul</p>", "<p>mot</p> ?"];
    for (const html of untouched) expect(typeset(html).html).toBe(html);
  });

  test("typesets the readable attributes only", () => {
    expect(
      typeset(
        '<meta name="description" content="Autorité : contrats"><img alt="Vue : carte" src="/a b :c">',
      ).html,
    ).toBe(
      `<meta name="description" content="Autorité${NBSP}: contrats"><img alt="Vue${NBSP}: carte" src="/a b :c">`,
    );
    expect(typeset('<meta name="viewport" content="a ; b">').html).toBe(
      '<meta name="viewport" content="a ; b">',
    );
    expect(typeset('<a title="Titre : x" aria-label="Nom ? y" href="/">z</a>').html).toBe(
      `<a title="Titre${NBSP}: x" aria-label="Nom${NBSP}? y" href="/">z</a>`,
    );
  });

  test("counts what it replaced", () => {
    expect(typeset("<p>a : b ; « c »</p>").replaced).toBe(4);
    expect(typeset("<p>rien à faire</p>").replaced).toBe(0);
  });

  test("groups thousands with no-break spaces", () => {
    expect(typeset("<p>1 200, 2 650, 1 234 567.</p>").html).toBe(
      `<p>1${NBSP}200, 2${NBSP}650, 1${NBSP}234${NBSP}567.</p>`,
    );
  });

  test("binds a number to the unit, sign or word that follows it", () => {
    expect(typeset("<p>Payer 480 € pour 3 jours, 12 mars, 50 % et 4 personnes</p>").html).toBe(
      `<p>Payer 480${NBSP}€ pour 3${NBSP}jours, 12${NBSP}mars, 50${NBSP}% et 4${NBSP}personnes</p>`,
    );
    expect(typeset("<p>Jeudi 14 h 30, 1 200 euros</p>").html).toBe(
      `<p>Jeudi 14${NBSP}h${NBSP}30, 1${NBSP}200${NBSP}euros</p>`,
    );
  });

  test("keeps « sur » with the total in a rank, so the line breaks before it", () => {
    expect(typeset("<p>Étape 1 sur 7, 2 sur 6 personnes</p>").html).toBe(
      `<p>Étape${NBSP}1 sur${NBSP}7, 2 sur${NBSP}6${NBSP}personnes</p>`,
    );
  });

  test("binds a numbering word to its number", () => {
    expect(typeset("<p>Étape 1, chapitre 4, Version 7, ADR 0005, n° 3</p>").html).toBe(
      `<p>Étape${NBSP}1, chapitre${NBSP}4, Version${NBSP}7, ADR${NBSP}0005, n°${NBSP}3</p>`,
    );
    // Only the closed list of numbering words binds forward to a number.
    expect(typeset("<p>avec 4, sur 6.</p>").html).toBe("<p>avec 4, sur 6.</p>");
  });

  test("leaves what is not a number of the text as written", () => {
    const untouched = [
      "<p>snapshot 65cba786 is pinned</p>",
      "<p>la 0.2.0 de la bibliothèque</p>",
      "<p>G2 fiches, S3.2 licences, #142 Export, Ed25519 —</p>",
      "<p>à 12:40, 2026-10-07 et 4 · 6</p>",
    ];
    for (const html of untouched) expect(typeset(html).html).toBe(html);
  });

  test("is idempotent", () => {
    const once = typeset("<p>« a : b ? »</p>").html;
    expect(typeset(once)).toEqual({ html: once, replaced: 0 });
  });
});
