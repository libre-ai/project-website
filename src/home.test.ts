import { describe, expect, test } from "bun:test";

import { buildCorpus } from "./corpus";
import type { PublicBrandCopy } from "./domain";
import { renderPages } from "./pages";
import { parseProjectCard } from "./project-card";

const cards = [
  parseProjectCard({
    project: "sketch",
    repository: "libre-ai/sketch",
    exposure: "idea",
    maturity: "idea",
    summary: "Résumé court.",
    current_situation: "Aucun code n'existe encore à ce stade.",
    non_goals: ["Pas d'engagement de date."],
    freshness: { last_verified_on: "2026-10-08" },
  }),
];
const corpus = buildCorpus(cards);

// Distinctive values: a field typed by hand on the page could never equal one of these.
const brand: PublicBrandCopy = {
  tension: "TENSION-7f3a",
  promise: "PROMISE-7f3a",
  explanation: "EXPLANATION-7f3a",
  qualification: "QUALIFICATION-7f3a",
  reasonToBelieve: "REASON-7f3a",
  primaryCta: "PRIMARY-7f3a",
  secondaryCta: "SECONDARY-7f3a",
};

const home = (value?: PublicBrandCopy) =>
  renderPages(corpus, cards, [], new Map(), value).get("/") ?? "";

describe("home page copy (O2, S1.1)", () => {
  test("renders the seven projection fields, none typed on the page", () => {
    const html = home(brand);
    for (const value of Object.values(brand)) expect(html).toContain(value);
    expect(Object.keys(brand)).toHaveLength(7);
  });

  test("the promise is the page's only h1", () => {
    const html = home(brand);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain("<h1>PROMISE-7f3a</h1>");
  });

  test("the calls to action keep their targets and take their labels from the projection", () => {
    const html = home(brand);
    expect(html).toContain('<a href="/produits">PRIMARY-7f3a</a>');
    expect(html).toContain('<a href="/preuves">SECONDARY-7f3a</a>');
  });

  test("a field value is escaped before it reaches the page", () => {
    const html = home({ ...brand, tension: '<img src="x">' });
    expect(html).not.toContain('<img src="x">');
    expect(html).toContain("&lt;img");
  });

  test("without a projection the home page states no brand copy", () => {
    const html = home();
    expect(html).toContain("<h1>Libre AI</h1>");
    expect(html).not.toContain("Possédez");
    expect(html).not.toContain("Prenez les clés");
  });
});
