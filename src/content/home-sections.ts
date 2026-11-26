import type { UniverseId } from "./universes";

export const COMPARISONS = [
  {
    before: "Vos données partent chez un fournisseur d'IA à l'étranger.",
    after: "Les agents travaillent chez vous, ou chez un hébergeur européen si vous l'autorisez.",
    icons: ["cloud", "home"],
    universe: "se-proteger",
  },
  {
    before: "Une licence par outil et par poste, et vos données prises en otage.",
    after: "Des logiciels libres, sans licence par poste, et une sortie prévue avec vos données.",
    icons: ["lock", "door"],
    universe: "travailler-ensemble",
  },
  {
    before: "Des agents qui agissent sans que personne ne sache comment.",
    after: "Chaque action d'agent est autorisée, vérifiée et tracée.",
    icons: ["box", "window"],
    universe: "s-informer",
  },
  {
    before: "« Faites-nous confiance. »",
    after:
      "La chaîne prévoit des versions signées et des preuves publiques, que vous pouvez vérifier.",
    icons: ["speech", "seal"],
    universe: "ecrire-calculer",
  },
] as const;

export const UNIVERSE_DESCRIPTIONS: Readonly<Record<UniverseId, string>> = {
  "s-informer": "L'information avec sa source, toujours.",
  "ecrire-calculer": "Écrire, calculer et présenter dans des formats ouverts.",
  "travailler-ensemble": "Décider à plusieurs sans céder vos échanges.",
  "creer-publier": "Créer et publier sans céder vos contenus ni vos clés.",
  apprendre: "Apprendre à partir de ce que vous avez déjà.",
  "se-divertir": "Lire, écouter, regarder et jouer sans pistage.",
  "se-proteger": "Vos clés, vos sauvegardes, vos accès. Chez vous.",
  "piloter-ia": "L'IA à votre service, à vos conditions.",
};

export const PROOFS = [
  {
    title: "La signature",
    text: "Vérifier d'où vient une version et si elle a été modifiée.",
    icon: "seal",
    universe: "ecrire-calculer",
  },
  {
    title: "Le journal de fabrication",
    text: "Retrouver qui a fait quoi, avec quelle autorisation et quel modèle, sans contenu personnel.",
    icon: "journal",
    universe: "s-informer",
  },
  {
    title: "Les vérifications passées",
    text: "Lire le résultat de chaque règle rejouée pour cette version précise.",
    icon: "list",
    universe: "se-proteger",
  },
  {
    title: "L'accessibilité",
    text: "Examiner le contrôle d'accessibilité, critère par critère.",
    icon: "access",
    universe: "apprendre",
  },
  {
    title: "Les cas de test publics",
    text: "Rejouer les contrats et leurs exemples chez soi.",
    icon: "replay",
    universe: "piloter-ia",
  },
  {
    title: "La sortie",
    text: "Comparer l'empreinte d'un export pour vérifier que rien ne manque.",
    icon: "export",
    universe: "travailler-ensemble",
  },
] as const;

export const QUESTIONS = [
  {
    question: "Que veut dire « posséder la fabrique » ?",
    answer:
      "Disposer de toute la chaîne qui produit les applications : les agents, les règles, les vérifications et les preuves. Le but est qu'elle tourne chez vous, sous vos décisions.",
  },
  {
    question: "Où vont mes données ?",
    answer:
      "La règle est de les garder sur votre appareil. Si un calcul doit se faire ailleurs, c'est chez un hébergeur en Europe, et seulement si vous l'acceptez.",
  },
  {
    question: "Un agent peut-il agir dans mon dos ?",
    answer:
      "Dans la fabrique, il n'agit que dans le cadre que vous avez autorisé, sous sa propre identité, et ses actions sont tracées. Les décisions importantes restent les vôtres.",
  },
] as const;

export const STARTING_PATHS = [
  {
    title: "Adoptez une application",
    text: "Repérez une application et suivez son avancement jusqu'à sa publication.",
    href: "/applications/",
    label: "Voir les applications",
  },
  {
    title: "Faites tourner la chaîne sur votre besoin",
    text: "Voyez comment une demande devient une application vérifiée sous vos règles.",
    href: "/fabrique/",
    label: "Comprendre la fabrique",
  },
  {
    title: "Installez votre fabrique",
    text: "Découvrez ce qu'il faut préparer pour faire tourner la chaîne chez vous, avec vos règles et vos données.",
    href: "/deployer/",
    label: "Consulter les conditions de déploiement",
  },
] as const;
