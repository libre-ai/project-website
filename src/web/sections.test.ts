import { describe, expect, test } from "bun:test";

import { APPLICATIONS, applicationOf } from "../content/applications";
import { layers, tour } from "../content/factory";
import { journeys } from "../content/journeys";
import { UNIVERSES } from "../content/universes";
import { findInlineStyles } from "./gates";
import { render } from "./html";
import {
  appCard,
  guidedTour,
  hoistedContentCss,
  journeyAccordion,
  layerExplorer,
  universeTabs,
} from "./sections";

describe("application card (ADR 0007 §5)", () => {
  const card = render(appCard(applicationOf("P07")));

  test("names the application « Libre <name> », links to its page and carries its universe", () => {
    expect(card).toContain('class="carte-application univers-apprendre"');
    expect(card).toContain(`href="/applications/${applicationOf("P07").slug}/"`);
    expect(card).toContain('Libre <span class="nom-libre">Révision</span>');
  });

  test("shows the function label, three tags, the emblem and a demo marked as an illustration", () => {
    expect(card.match(/class="etiquette"/g)).toHaveLength(3);
    expect(card).toContain('href="/assets/volee.svg#embleme-p07"');
    expect(card).toMatch(
      /<figure class="demo" aria-hidden="true">.*Illustration<\/span><\/figure>/s,
    );
  });

  test("never offers a trial, a download or an availability", () => {
    expect(card).not.toMatch(/disponible|télécharg|essayer maintenant/i);
  });
});

describe("universe tabs (ADR 0007 §6)", () => {
  const tabs = render(universeTabs());

  test("without script: an in-page menu and one titled section per universe", () => {
    expect(tabs).toContain("data-onglets");
    for (const universe of UNIVERSES) {
      expect(tabs).toContain(
        `<a href="#${universe.id}">${universe.verb.replace("'", "&#39;")}</a>`,
      );
      expect(tabs).toContain(`<section id="${universe.id}" class="univers-${universe.id}"`);
    }
  });

  test("every application appears once, in its universe", () => {
    expect(tabs.match(/class="carte-application /g)).toHaveLength(APPLICATIONS.length);
  });
});

describe("journeys, tour and layers (ADR 0007 §7)", () => {
  test("journeys are one exclusive accordion, the first open, each result marked as an illustration", () => {
    const accordion = render(journeyAccordion());
    expect(accordion.match(/<details name="parcours"/g)).toHaveLength(journeys.length);
    expect(accordion.match(/<details name="parcours" open>/g)).toHaveLength(1);
    expect(accordion.match(/Illustration du résultat visé/g)).toHaveLength(journeys.length);
  });

  test("the tour lists every step without script and is marked for the module", () => {
    const visit = render(guidedTour());
    expect(visit).toContain("data-visite");
    expect(visit.match(/data-etape/g)).toHaveLength(tour.length);
  });

  test("layers are native exclusive details, each naming the layers it relates to", () => {
    const explorer = render(layerExplorer());
    expect(explorer).toContain("data-couches");
    expect(explorer.match(/<details name="couches"/g)).toHaveLength(layers.length);
    for (const layer of layers) expect(explorer).toContain(`data-relie="${layer.links.join(" ")}"`);
  });
});

describe("hoisted content styles", () => {
  test("every rendered section is free of inline styles", () => {
    for (const html of [
      render(universeTabs()),
      render(journeyAccordion()),
      render(guidedTour()),
      render(layerExplorer()),
    ]) {
      expect(findInlineStyles(html)).toEqual([]);
    }
  });

  test("every generated class used by a section has its rule, and the rules are deterministic", () => {
    const css = hoistedContentCss();
    const used = new Set(
      [render(universeTabs()), render(journeyAccordion()), render(guidedTour())].flatMap((html) =>
        [...html.matchAll(/\bs-[a-z0-9-]+-\d+\b/g)].map((match) => match[0]),
      ),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) expect(css).toContain(`.${name}{`);
    expect(hoistedContentCss()).toBe(css);
  });
});
