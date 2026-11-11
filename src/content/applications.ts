/**
 * The 40 Libre applications (ADR 0007 §5), displayed « Libre <name> ». Six names were arbitrated
 * on 2026-11-09; the 34 others are the prototype's, marked `provisoire`: the owner renames them
 * (decision of 2026-11-11) and replacing a name here changes nothing else, because emblems,
 * showcases and waitlist interests are keyed by reference, and the slug follows the name.
 * Promises are those of the prototype accepted on 2026-11-09.
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
  ["P01", "Sources", "Explorez le web et repartez avec des sources attribuées et vérifiables."],
  ["P02", "Veille", "Une veille reliée à vos questions, qui dit pourquoi chaque article compte."],
  ["P03", "Corpus", "Explorez, qualifiez et entretenez votre bibliothèque Zotero."],
  ["P04", "Notes", "Capturez vos idées avec leur contexte, éditables et exportables."],
  ["P05", "Wiki", "Procédures, glossaires et décisions, attribués et tenus à jour."],
  [
    "P06",
    "Recherche",
    "Retrouvez n'importe quoi dans vos applications, sans mélanger les données.",
  ],
  ["P07", "Révision", "Transformez vos sources en apprentissage qui dure."],
  ["P08", "Docs", "Rédigez, relisez à plusieurs, exportez un fichier qui s'ouvre partout."],
  ["P09", "Tableur", "Des calculs exacts, explicables et reproductibles."],
  ["P10", "Diapos", "D'un message à une présentation cohérente, éditable et exportable."],
  ["P11", "Fichiers", "Synchronisez et partagez vos fichiers avec des droits que vous comprenez."],
  ["P12", "PDF", "Rendez lisibles, recherchables et annotables les documents reçus."],
  ["P13", "Formulaires", "Collectez des réponses et exploitez-les dans des tables cohérentes."],
  ["P14", "Canevas", "Réfléchissez en visuel, puis transformez vos décisions en tâches."],
  ["P15", "Tickets", "D'une demande à sa résolution vérifiée, sans rien perdre en route."],
  ["P16", "Tâches", "Notez une action, retrouvez-la au bon moment."],
  ["P17", "Mail", "Vos e-mails, une recherche fiable, des envois sans ambiguïté."],
  ["P18", "Visio", "Discutez et réunissez-vous dans des espaces aux droits clairs."],
  ["P19", "Agenda", "Coordonnez les disponibilités sans exposer votre vie privée."],
  ["P20", "Relations", "Vos contacts et l'historique de vos échanges, au même endroit."],
  ["P21", "Réunion", "Transformez une réunion en décisions et en actions vérifiables."],
  ["P22", "Vidéo", "D'une intention à une vidéo montée, révisable et exportable."],
  ["P23", "Prototype", "Essayez une évolution produit à partir de votre propre code."],
  ["P24", "Audio", "Enregistrez, montez et publiez vos podcasts."],
  ["P25", "Site", "Construisez un site dont vous gardez le contenu et la publication."],
  [
    "P26",
    "Diffusion",
    "Faites connaître vos contenus sur les bons canaux, sans perdre le contrôle.",
  ],
  ["P27", "Ressources", "Retrouvez le bon média et sachez comment le réutiliser."],
  ["P28", "Tempo", "Retrouvez vos réglages de lecture sur les sites compatibles."],
  ["P29", "Antenne", "Vos abonnements vidéo, sans pistage, avec votre propre historique."],
  ["P30", "Lecture", "Lisez et rangez mangas, BD et livres dans des formats ouverts."],
  ["P31", "Médiathèque", "Vos musiques et vidéos, sur les appareils que vous choisissez."],
  ["P32", "JdR", "Préparez et jouez vos campagnes, le groupe garde la main."],
  ["P33", "Routeur", "Le bon modèle d'IA pour chaque usage, selon des règles vérifiées."],
  ["P34", "Assistant", "Un assistant qui montre ses sources et demande avant d'agir."],
  ["P35", "Automates", "Automatisez des enchaînements explicites, testés avant d'être activés."],
  ["P36", "VPN", "Reliez vos appareils et vos services privés avec des règles explicites."],
  ["P37", "Coffre", "Vos mots de passe et secrets, partagés et révoqués sous contrôle."],
  ["P38", "Sauvegarde", "Des sauvegardes réellement restaurées, pas seulement copiées."],
  ["P39", "Cours", "Créez des activités depuis vos sources et animez vos séances en direct."],
  ["P40", "Fenêtres", "Rangez vos fenêtres d'un geste, sur tous vos écrans."],
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
