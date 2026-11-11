import { describe, expect, test } from "bun:test";

import { checkCopy, checkInternalLinks, findInlineStyles } from "./gates";

describe("findInlineStyles (ADR 0005)", () => {
  test("finds a style attribute and a style element, nothing else", () => {
    expect(findInlineStyles('<p style="x">a</p><style>p{}</style><p class="styled">b</p>')).toEqual(
      [' style="', "<style"],
    );
    expect(findInlineStyles('<p data-style="x" class="style">ok</p>')).toEqual([]);
  });
});

describe("checkCopy (ADR 0007)", () => {
  const page = (text: string) => [{ page: "index.html", html: `<main><p>${text}</p></main>` }];

  test.each([
    ["an availability claim", "Libre Notes est disponible dès aujourd'hui."],
    ["a download offer", "Téléchargez Libre Notes."],
    ["a trial offer", "Essayer maintenant"],
    ["an open beta", "La bêta ouverte commence."],
    ["a count of applications", "Déjà 40 applications."],
    ["a count of repositories", "15 dépôts publics"],
    ["a progress percentage", "Avancement : 73 %"],
  ])("flags %s", (_case, text) => {
    expect(checkCopy(page(text)).violations).toHaveLength(1);
  });

  test("leaves a promise, a duration and a reference alone", () => {
    const report = checkCopy(
      page("Ce que chacun réinvente seul, faisons-le ensemble. Confirmez sous 48 heures. P07."),
    );
    expect(report.violations).toEqual([]);
    expect(report.examined).toBe(1);
  });

  test("reads text, not markup: an attribute value is not copy", () => {
    expect(
      checkCopy([{ page: "a.html", html: '<a href="/telecharger/">Lien</a>' }]).violations,
    ).toEqual([]);
  });
});

describe("checkInternalLinks", () => {
  const files = new Map<string, string | Uint8Array>([
    [
      "index.html",
      '<a href="/applications/">A</a><a href="/nulle-part/">X</a><a href="#contenu">S</a><a href="https://github.com/libre-ai">G</a><svg><use href="/assets/volee.svg#martinet"/></svg>',
    ],
    [
      "applications/index.html",
      '<a href="/?x=1">Accueil</a><link href="/assets/site.css" rel="stylesheet">',
    ],
    ["assets/volee.svg", "<svg/>"],
    ["assets/site.css", ""],
  ]);

  test("follows local links and references, ignoring anchors, queries and external links", () => {
    const report = checkInternalLinks(files);
    expect(report.broken).toEqual(["index.html -> /nulle-part/"]);
    // index.html: /applications/, /nulle-part/, the sprite; applications/index.html: /?x=1, the sheet.
    expect(report.examined).toBe(5);
  });
});
