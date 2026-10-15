/**
 * The constellation in numbers (S1.3, FR-13): products, numbered layers in use and transverse
 * products, all counted from the project cards, never typed. The sentence names its source and
 * the latest verification date, and says nothing about state.
 */
import type { ProjectCard } from "./project-card";

export interface Constellation {
  readonly products: number;
  readonly layers: number;
  readonly transverse: number;
  readonly verifiedOn: string;
}

export function constellationOf(cards: readonly ProjectCard[]): Constellation {
  // Zero cards would print "0 produit": an unreadable source, not an answer.
  if (cards.length === 0) throw new Error("constellation.no_cards");
  const layers = new Set(cards.filter((card) => card.layer !== "transverse").map((c) => c.layer));
  // ISO days sort as text, so the latest is the greatest.
  const verifiedOn = cards.map((card) => card.lastVerifiedOn).reduce((a, b) => (b > a ? b : a));
  return {
    products: cards.length,
    layers: layers.size,
    transverse: cards.filter((card) => card.layer === "transverse").length,
    verifiedOn,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function constellationSentence(value: Constellation): string {
  const transverse =
    value.transverse === 0 ? "" : `, dont ${plural(value.transverse, "transverse", "transverses")}`;
  return `${plural(value.products, "produit", "produits")} dans ${plural(value.layers, "couche", "couches")}${transverse}, comptés dans les fiches de projet (dernière vérification : ${value.verifiedOn}).`;
}
