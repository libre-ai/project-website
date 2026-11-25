/**
 * Copy of the opening and the four moments of the home page (ADR 0010 §5 and §8), copied from the
 * redesign prototype judged in its version 17 (2026-11-24, `textes-v4.json`: `accroches`,
 * `accueil.pliage`, `accueil.notes.hero`, `accueil.moments_titre`, `accueil.moments`).
 *
 * Handwritten notes are set in Caveat, served as a subset holding only their characters
 * (src/design/fonts). Every note the site draws is listed in HAND_NOTES, and a test fails when a
 * note uses a character the subset lacks.
 */
import { MISSION_ORDER, TRANSFER } from "./trial";
import type { UniverseId } from "./universes";

export const OPENING = {
  title: "Possédez la fabrique.",
  subtitle:
    "Toute la chaîne pour produire avec l'IA et transformer votre entreprise. Vos données, vos règles, vos agents.",
  /** The instruction plate: an application icon, folded from a sheet of paper. */
  plate: { title: "Plier une application", application: "P04" },
  note: "Chaque oiseau est une application.",
  /** The first call of the opening (`accueil.boutons`), to the trial below. */
  trial: { label: "Essayer de piéger un agent", href: "#essai" },
} as const;

export type MomentId = "besoin" | "construire" | "verifier" | "signer";

export interface Moment {
  readonly id: MomentId;
  readonly title: string;
  readonly text: string;
  /** The universe whose tints colour the moment's drawing. */
  readonly universe: UniverseId;
  /** Handwritten beside the drawing. */
  readonly note: string;
}

export const MOMENTS_TITLE = "De votre besoin à l'application livrée";

export const MOMENTS: readonly Moment[] = [
  {
    id: "besoin",
    title: "Vous décrivez le besoin",
    text: "En mots simples : ce que l'application doit faire, et ce qu'elle ne fera jamais.",
    universe: "ecrire-calculer",
    note: "c'est vous",
  },
  {
    id: "construire",
    title: "Les agents construisent",
    text: "Chacun dans son espace isolé, avec le strict nécessaire.",
    universe: "se-proteger",
    note: "eux, sous clé",
  },
  {
    id: "verifier",
    title: "Les règles vérifient",
    text: "Un seul écart, et tout s'arrête. Vous tranchez ce qui compte.",
    universe: "s-informer",
    note: "personne n'y échappe",
  },
  {
    id: "signer",
    title: "Vous recevez, signé",
    text: "Une application prête, avec ses preuves. Ce qui a servi resservira.",
    universe: "travailler-ensemble",
    note: "c'est à vous",
  },
];

/** Every handwritten text the site draws: the Caveat subset holds exactly their characters. */
export const HAND_NOTES: readonly string[] = [
  OPENING.plate.title,
  OPENING.note,
  ...MOMENTS.map((moment) => moment.note),
  MISSION_ORDER.noteTabs,
  MISSION_ORDER.noteFold,
  MISSION_ORDER.noteStub,
  TRANSFER.note,
];

/** The characters of the handwritten notes, each once, in code point order. */
export function handCharacters(notes: readonly string[] = HAND_NOTES): string {
  return [...new Set([...notes.join("")])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join("");
}
