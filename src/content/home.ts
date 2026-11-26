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
    "Nous construisons une chaîne libre pour créer des applications avec l'IA. Le but : récupérer le code, les règles et vos données, puis réinstaller l'application ailleurs.",
  /** The instruction plate: an application icon, folded from a sheet of paper. */
  plate: { title: "Plier une application", application: "P04" },
  note: "Chaque oiseau est une application.",
  /** The first call of the opening (`accueil.boutons`), to the trial below. */
  trial: { label: "Voir une règle bloquer un virement", href: "#ordre-compta" },
  delivery: { label: "Voir ce que vous récupérez", href: "#fabrication" },
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
    title: "Les contrôles bloquent les actions interdites",
    text: "Par exemple, un agent peut préparer un virement, mais il ne peut pas l'envoyer sans validation humaine.",
    universe: "s-informer",
    note: "personne n'y échappe",
  },
  {
    id: "signer",
    title: "Vous recevez le code et ses preuves",
    text: "Le code source, les résultats des contrôles pour cette version et un guide pour réinstaller l'application ailleurs.",
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
export const DELIVERY = {
  title: "Ce que vous recevriez avec l'application",
  lead: "Exemples fictifs de livraison. Le besoin change ; l'objectif reste de pouvoir récupérer le code, les règles et vos données.",
  examples: [
    {
      application: "P19",
      nextLabel: "Voir l'Agenda",
      caption: "Réinstaller l'Agenda et restaurer les rendez-vous.",
      pieces: [
        {
          icon: "request",
          title: "Ce que vous avez demandé",
          text: "« Que nos clients puissent choisir un créneau sans voir le reste de notre calendrier. »",
        },
        {
          icon: "code",
          title: "Le code source",
          text: "Le code de prise de rendez-vous, pour le relire ou le faire modifier.",
        },
        {
          icon: "rules",
          title: "Les règles de l'application",
          text: "Montrer les créneaux libres, jamais les autres rendez-vous.",
        },
        {
          icon: "record",
          title: "Le journal des versions",
          text: "Pour chaque version : qui l'a faite, qui l'a relue et quels contrôles ont été effectués.",
        },
        {
          icon: "guide",
          title: "Le guide de réinstallation",
          text: "Comment réinstaller Agenda sur un autre serveur et y restaurer les rendez-vous.",
        },
        {
          icon: "data",
          title: "L'export de vos rendez-vous",
          text: "Un fichier CSV que vous pouvez ouvrir dans un tableur.",
        },
      ],
    },
    {
      application: "P05",
      nextLabel: "Voir le Wiki",
      caption: "Réinstaller le Wiki et restaurer les pages et leur historique.",
      pieces: [
        {
          icon: "request",
          title: "Ce que vous avez demandé",
          text: "« Que l'équipe retrouve la procédure en vigueur et sache qui l'a validée. »",
        },
        {
          icon: "code",
          title: "Le code source",
          text: "Le code qui permet de rédiger, relire et publier les procédures.",
        },
        {
          icon: "rules",
          title: "Les règles de l'application",
          text: "Ne publier aucune nouvelle version sans relecture par une autre personne.",
        },
        {
          icon: "record",
          title: "Le journal des versions",
          text: "Pour chaque procédure : les modifications, leur date et le nom de la personne qui a validé la version.",
        },
        {
          icon: "guide",
          title: "Le guide de réinstallation",
          text: "Comment réinstaller Wiki et y restaurer les pages et leur historique.",
        },
        {
          icon: "data",
          title: "L'export de vos procédures",
          text: "Les pages et leur historique dans un format ouvert.",
        },
      ],
    },
    {
      application: "P13",
      nextLabel: "Voir Formulaires",
      caption: "Réinstaller les formulaires et restaurer les réponses.",
      pieces: [
        {
          icon: "request",
          title: "Ce que vous avez demandé",
          text: "« Recueillir les inscriptions à nos ateliers sans rendre les réponses publiques. »",
        },
        {
          icon: "code",
          title: "Le code source",
          text: "Le code qui affiche les formulaires et enregistre les réponses.",
        },
        {
          icon: "rules",
          title: "Les règles de l'application",
          text: "Seules les personnes qui organisent l'atelier peuvent lire les réponses.",
        },
        {
          icon: "record",
          title: "Le journal des versions",
          text: "Les changements apportés aux champs et aux droits de lecture, version par version.",
        },
        {
          icon: "guide",
          title: "Le guide de réinstallation",
          text: "Comment recréer les formulaires ailleurs et vérifier les droits avant de les rouvrir.",
        },
        {
          icon: "data",
          title: "L'export de vos réponses",
          text: "Les définitions des formulaires et les réponses dans des fichiers séparés.",
        },
      ],
    },
    {
      application: "P25",
      nextLabel: "Voir le Site",
      caption: "Réinstaller le Site et retrouver les pages et leurs images.",
      pieces: [
        {
          icon: "request",
          title: "Ce que vous avez demandé",
          text: "« Publier les informations de l'association et pouvoir changer d'hébergeur. »",
        },
        {
          icon: "code",
          title: "Le code source",
          text: "Le code qui transforme les contenus en pages du site.",
        },
        {
          icon: "rules",
          title: "Les règles de l'application",
          text: "Les brouillons ne sont pas publics. Une personne autorisée décide de leur publication.",
        },
        {
          icon: "record",
          title: "Le journal des versions",
          text: "Pour chaque publication : les pages modifiées et les résultats du contrôle des liens.",
        },
        {
          icon: "guide",
          title: "Le guide de réinstallation",
          text: "Comment reconstruire le site chez un autre hébergeur et y raccorder votre nom de domaine.",
        },
        {
          icon: "data",
          title: "L'export de vos contenus",
          text: "Les textes en Markdown et les images dans leurs fichiers d'origine.",
        },
      ],
    },
  ],
} as const;
