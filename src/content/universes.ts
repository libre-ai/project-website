/**
 * The eight universes, named by a verb (ADR 0007 §6), and the universe of each application.
 * Distribution validated by the owner on 2026-11-11 (Libre Fenêtres, P40, in « Piloter l'IA »).
 */
import type { UniverseHueId } from "../design/palette";

export type UniverseId = UniverseHueId;

export interface Universe {
  readonly id: UniverseId;
  readonly verb: string;
}

/** Display order of the tabs on the home page. */
export const UNIVERSES: readonly Universe[] = [
  { id: "s-informer", verb: "S'informer" },
  { id: "ecrire-calculer", verb: "Écrire et calculer" },
  { id: "travailler-ensemble", verb: "Travailler ensemble" },
  { id: "creer-publier", verb: "Créer et publier" },
  { id: "apprendre", verb: "Apprendre" },
  { id: "se-divertir", verb: "Se divertir" },
  { id: "se-proteger", verb: "Se protéger" },
  { id: "piloter-ia", verb: "Piloter l'IA" },
];

const DISTRIBUTION: Readonly<Record<UniverseId, readonly string[]>> = {
  "s-informer": ["P01", "P02", "P03", "P06"],
  "ecrire-calculer": ["P04", "P08", "P09", "P10", "P12", "P13"],
  "travailler-ensemble": ["P05", "P11", "P14", "P15", "P16", "P17", "P18", "P19", "P20", "P21"],
  "creer-publier": ["P22", "P23", "P24", "P25", "P26", "P27"],
  apprendre: ["P07", "P39"],
  "se-divertir": ["P28", "P29", "P30", "P31", "P32"],
  "se-proteger": ["P36", "P37", "P38"],
  "piloter-ia": ["P33", "P34", "P35", "P40"],
};

export const UNIVERSE_OF: Readonly<Record<string, UniverseId>> = Object.fromEntries(
  (Object.entries(DISTRIBUTION) as [UniverseId, readonly string[]][]).flatMap(([id, refs]) =>
    refs.map((ref) => [ref, id] as const),
  ),
);

export function universeOf(ref: string): UniverseId {
  const id = UNIVERSE_OF[ref];
  if (id === undefined) throw new Error(`content.universe_unknown:${ref}`);
  return id;
}
