import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { HAND_NOTES } from "../content/home";
import { CAVEAT_SUBSET, type SubsetManifest } from "../font";
import { render } from "./html";
import { homeMain } from "./pages";
import { typeset } from "./typography";

const home = typeset(render(homeMain())).html;

// The renderer escapes text; the notes are compared as the reader sees them.
const ENTITIES: Readonly<Record<string, string>> = {
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
};
const decode = (html: string): string =>
  html.replace(/&(?:#39|quot|lt|gt|amp);/g, (entity) => ENTITIES[entity] ?? entity);
const text = decode(home);

// Text of every element whose class list holds `note-main`, up to its first child tag.
const notes = [...home.matchAll(/<[a-z]+ class="note-main[^"]*">([^<]*)/g)].map((match) =>
  decode(match[1] ?? ""),
);

describe("the opening of the home page (ADR 0010 §5 and §8)", () => {
  // Expected copy written from ADR 0010, not from src/content/home.ts.
  test("is the promise of the ADR, as the page's only h1", () => {
    expect(home.match(/<h1\b[^>]*>([^<]*)<\/h1>/g)).toEqual([
      '<h1 id="titre-accueil">Possédez la fabrique.</h1>',
    ]);
    expect(text).toContain(
      "Nous construisons une chaîne libre pour créer des applications avec l'IA.",
    );
    expect(text).toContain("récupérer le code, les règles et vos données");
    expect(text).toContain('href="#fabrication">Voir ce que vous récupérez</a>');
  });

  test("shows the plate with a real application, linked to its page", () => {
    expect(home).toContain('<figure class="planche univers-');
    expect(home).toMatch(/<p class="planche-nom"><a href="\/applications\/[a-z0-9-]+\/">Libre /);
  });

  test("comes first, then the four moments, then the rest of the page", () => {
    const opening = home.indexOf('class="ouverture"');
    const momentsAt = home.indexOf('id="moments"');
    const journeys = home.indexOf('id="parcours"');
    expect(opening).toBeGreaterThanOrEqual(0);
    expect(momentsAt).toBeGreaterThan(opening);
    expect(journeys).toBeGreaterThan(momentsAt);
  });

  test("the retired « Seul / Ensemble » screen and the three steps are gone (ADR 0010 §4)", () => {
    expect(home).not.toContain("data-seul-ensemble");
    expect(home).not.toContain('name="avancer"');
    expect(home).not.toContain("trois-temps");
  });
});

describe("the four moments (ADR 0010 §8)", () => {
  test("carry the title of the ADR and four steps, each with a drawing and a note", () => {
    expect(text).toContain(">De votre besoin à l'application livrée</h2>");
    const items = home.match(/<li class="moment univers-[a-z-]+">/g) ?? [];
    expect(items).toHaveLength(4);
    const section = home.slice(home.indexOf('id="moments"'), home.indexOf('id="parcours"'));
    expect(section.match(/<div class="moment-dessin"><svg /g)).toHaveLength(4);
    expect(section.match(/class="note-main moment-note"/g)).toHaveLength(4);
    expect(text).toContain("Les contrôles bloquent les actions interdites");
    expect(text).toContain("il ne peut pas l'envoyer sans validation humaine");
  });

  test("drawings take their colours from the universe's facet tokens only", () => {
    const section = home.slice(home.indexOf('id="moments"'), home.indexOf('id="parcours"'));
    const colours = section.match(/(?:fill|stroke)="[^"]*"/g) ?? [];
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) {
      expect(colour).toMatch(/^(?:fill|stroke)="(?:none|currentColor|var\(--facette-[1-5]\))"$/);
    }
  });
});

describe("the rest of the home page (ADR 0010 §8)", () => {
  test("preserves the reading order and links the opening to the three starting paths", () => {
    const ids = [
      "essai",
      "parcours",
      "univers",
      "virement",
      "fabrication",
      "preuves",
      "questions",
      "commencer",
      "rejoindre",
    ];
    let previous = -1;
    for (const id of ids) {
      const position = home.indexOf(`id="${id}"`);
      expect(position, id).toBeGreaterThan(previous);
      previous = position;
    }
    expect(home).not.toContain('name="parcours"');
    expect(home).not.toContain('action="/inscription"');
    expect(home).not.toContain("/methode/");
  });

  test("distinguishes public build results from evidence planned for releases", () => {
    const section = text.slice(text.indexOf('id="preuves"'), text.indexOf('id="questions"'));
    const published = section.indexOf("À vérifier aujourd'hui");
    const planned = section.indexOf("Prévu pour les applications");
    expect(published).toBeGreaterThanOrEqual(0);
    expect(planned).toBeGreaterThan(published);
    expect(section.slice(published, planned)).toContain('href="/preuves/"');
    expect(section.slice(planned)).toContain("La signature");
    expect(text).toContain("Préparer un déploiement");
  });
});

describe("handwritten notes on the home page (ADR 0010 §2)", () => {
  test("every note drawn is one of HAND_NOTES, as served after typesetting", () => {
    expect(notes.length).toBeGreaterThanOrEqual(6);
    for (const note of notes) expect(HAND_NOTES).toContain(note);
  });

  test("every character of a drawn note is in the Caveat subset", async () => {
    const manifest = (await Bun.file(
      join(process.cwd(), CAVEAT_SUBSET.manifest),
    ).json()) as SubsetManifest;
    const kept = new Set(manifest.characters);
    const missing = [...new Set(notes.join(""))].filter((character) => !kept.has(character));
    expect(missing).toEqual([]);
  });
});
