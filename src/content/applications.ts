/**
 * The 41 Libre applications (ADR 0007 §5 as amended by ADR 0010 §7), displayed « Libre <name> ».
 * Six names are arbitrated (2026-11-09; Biblio replaced Corpus for P03 on 2026-11-24); the 35
 * others are marked `provisoire`: the owner renames them (decision of 2026-11-11) and replacing a
 * name here changes nothing else, because emblems, showcases and waitlist interests are keyed by
 * reference, and the slug follows the name. Names follow the product sheets of
 * `libre-ai/project-governance`. Promises are those of the redesign prototype judged in its
 * version 17 (2026-11-24): an intention, never a claim that the application exists.
 */
import { UNIVERSE_OF, type UniverseId } from "./universes";

export interface Application {
  readonly ref: string;
  readonly name: string;
  readonly nameStatus: "tranché" | "provisoire";
  readonly slug: string;
  readonly universe: UniverseId;
  readonly promise: string;
}

/** URL-safe form of a name: accents folded, lower case, words joined by hyphens. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const DECIDED = new Set(["P01", "P03", "P14", "P28", "P29", "P39"]);

const ENTRIES: readonly (readonly [string, string, string])[] = [
  ["P01", "Sources", "Cherchez sur le web. Chaque information arrive avec sa source."],
  ["P02", "Veille", "Votre veille faite pour vous, avec la raison de chaque article retenu."],
  ["P03", "Biblio", "Votre bibliothèque Zotero rangée et à jour, sans y passer vos soirées."],
  ["P04", "Notes", "Vos idées, avec leur contexte, partout où vous allez."],
  ["P05", "Wiki", "Les procédures et décisions de l'équipe, toujours à jour, toujours signées."],
  [
    "P06",
    "Recherche",
    "Retrouvez n'importe quoi, dans toutes vos applications, en une seule recherche.",
  ],
  ["P07", "Révision", "Retenez pour de bon ce que vous apprenez, à partir de vos propres sources."],
  [
    "P08",
    "Docs",
    "Écrivez à plusieurs en même temps, et exportez un fichier que tout le monde ouvre.",
  ],
  ["P09", "Tableur", "Des calculs justes, et vous comprenez pourquoi."],
  [
    "P10",
    "Diapos",
    "D'une idée à une présentation soignée, que vous modifiez et exportez à volonté.",
  ],
  ["P11", "Fichiers", "Partagez vos fichiers, et sachez toujours qui voit quoi."],
  ["P12", "PDF", "Lisez, cherchez et annotez tous vos PDF au même endroit."],
  ["P13", "Formulaires", "Posez vos questions, recevez des réponses déjà rangées."],
  ["P14", "Canevas", "Réfléchissez en dessinant, repartez avec des tâches claires."],
  [
    "P15",
    "Remontées",
    "Signalez un problème d'où vous êtes. L'équipe le reçoit aussitôt, là où elle travaille.",
  ],
  ["P16", "Tâches", "Ce qu'il faut faire, au bon moment, sans rien oublier."],
  ["P17", "Mail", "Vos e-mails, avec enfin une recherche qui trouve."],
  ["P18", "Visio", "Discutez et réunissez-vous chiffré, en sachant qui a accès à quoi."],
  ["P19", "Agenda", "Trouvez une date commune sans dévoiler votre agenda."],
  ["P20", "Relations", "Vos contacts et toute l'histoire de vos échanges, au même endroit."],
  [
    "P21",
    "Réunion",
    "Sortez de chaque réunion avec des décisions et des actions, pas des notes en vrac.",
  ],
  ["P22", "Vidéo", "De l'idée à la vidéo montée, retouchable jusqu'au bout."],
  ["P23", "Prototype", "Essayez une nouvelle fonction sur votre propre code, sans rien casser."],
  ["P24", "Audio", "Du micro à l'épisode publié : enregistrez, montez, diffusez votre podcast."],
  ["P25", "Site", "Votre site, vos contenus, vos clés. Personne d'autre."],
  ["P26", "Diffusion", "Publiez sur les bons réseaux sans leur céder vos contenus."],
  ["P27", "Ressources", "La bonne image, le bon son, et le droit de vous en servir."],
  ["P28", "Tempo", "Vos réglages de lecture vous suivent d'un site à l'autre."],
  ["P29", "Antenne", "Vos vidéos préférées, sans pistage, avec votre propre historique."],
  ["P30", "Lecture", "Mangas, BD, livres : lisez et rangez toute votre bibliothèque."],
  ["P31", "Médiathèque", "Votre musique et vos vidéos, sur tous vos appareils."],
  ["P32", "JdR", "Préparez et jouez vos parties de jeu de rôle, ensemble."],
  ["P33", "Routeur", "La bonne IA pour chaque tâche, choisie selon vos règles."],
  ["P34", "Assistant", "Un assistant qui cite ses sources et vous demande avant d'agir."],
  ["P35", "Automates", "Automatisez vos tâches répétitives, testées avant de tourner seules."],
  ["P36", "VPN", "Reliez vos appareils et vos services privés, selon vos règles."],
  ["P37", "Coffre", "Vos mots de passe, partagés et retirés d'un geste."],
  ["P38", "Sauvegarde", "Des sauvegardes dont on a vraiment testé la restauration."],
  ["P39", "Cours", "Créez des activités à partir de vos documents et animez vos cours en direct."],
  ["P40", "Fenêtres", "Rangez vos fenêtres d'un geste, sur tous vos écrans."],
  ["P41", "Tickets", "Chaque demande suivie jusqu'au bout. Rien ne se perd."],
];

export const APPLICATIONS: readonly Application[] = ENTRIES.map(([ref, name, promise]) => {
  const universe = UNIVERSE_OF[ref];
  if (universe === undefined) throw new Error(`content.universe_unknown:${ref}`);
  return {
    ref,
    name,
    nameStatus: DECIDED.has(ref) ? "tranché" : "provisoire",
    slug: slugify(name),
    universe,
    promise,
  };
});

const BY_REF: ReadonlyMap<string, Application> = new Map(
  APPLICATIONS.map((application) => [application.ref, application]),
);

export function applicationOf(ref: string): Application {
  const application = BY_REF.get(ref);
  if (application === undefined) throw new Error(`content.application_unknown:${ref}`);
  return application;
}
