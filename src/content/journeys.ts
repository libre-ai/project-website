// Promise-first content for the v3 prototype: journeys (from the vision's 8 parcours),
// the fabrication chain and the commons commitments. Result cards are illustrations of the
// intended outcome, never screenshots of an existing application (I-15).
// Ported unchanged from the prototype accepted on 2026-11-09; `apps` lists prototype keys, read
// through src/content/prototype-keys.ts. Cards are trusted authored HTML, hoisted at build time.

export interface Journey {
  id: string;
  intent: string;
  apps: readonly string[];
  result: string;
  comfort: string;
  card: string;
}

const tick = '<span class="coche" aria-hidden="true"></span>';

export const journeys: readonly Journey[] = [
  {
    id: "informer",
    intent: "M'informer sans me noyer",
    apps: ["sources", "veille", "corpus", "notes"],
    result: "Une veille qui dit pourquoi chaque article compte, et un corpus qui se tient à jour.",
    comfort: "Vous lisez ce qui sert vos questions, rien d'autre.",
    card: `<div class="carte-tete"><b>Votre veille de ce matin</b><span>3 éléments retenus</span></div>
      <ul class="veille">
        <li><b>Nouvelle étude sur les sols urbains</b><span>Pourquoi : répond à votre question « îlots de chaleur ».</span><i>Source vérifiée</i></li>
        <li><b>Mise à jour d'une norme que vous suivez</b><span>Pourquoi : modifie l'article cité dans vos notes.</span><i>Changement détecté</i></li>
        <li><b>Contradiction entre deux auteurs de votre corpus</b><span>Pourquoi : à trancher avant votre synthèse.</span><i>À examiner</i></li>
      </ul>`,
  },
  {
    id: "reunion",
    intent: "Transformer une réunion en actions",
    apps: ["agenda", "visio", "reunion", "taches"],
    result:
      "Un compte rendu relu, des décisions nettes et des actions confiées aux bonnes personnes.",
    comfort: "Plus personne ne se demande ce qui a été décidé.",
    card: `<div class="carte-tete"><b>Comité projet, compte rendu</b><span>Relu par 2 participants</span></div>
      <p class="sous">Décisions</p>
      <ul class="liste">${["Lancer la version bêta auprès des testeurs", "Reporter l'export PDF"].map((d) => `<li>${tick}${d}</li>`).join("")}</ul>
      <p class="sous">Actions</p>
      <ul class="actions-cr"><li><span class="pastille-p">AL</span>Préparer l'annonce</li><li><span class="pastille-p">CJ</span>Ouvrir l'accès testeurs</li></ul>`,
  },
  {
    id: "publier",
    intent: "Publier ce que je crée",
    apps: ["ressources", "video", "site", "diffusion"],
    result:
      "Une vidéo montée, publiée sur votre site et relayée sur vos canaux, sans plateforme qui la garde.",
    comfort: "Votre audience vous suit, pas un algorithme.",
    card: `<div class="video-vignette"><span class="lecture" aria-hidden="true"></span><b>Atelier compost, épisode 3</b></div>
      <div class="canaux"><span>Votre site</span><span>Lettre</span><span>Réseaux choisis</span></div>
      <p class="etat-carte">${tick}Programmé et vérifié avant envoi</p>`,
  },
  {
    id: "enseigner",
    intent: "Enseigner à partir de mes sources",
    apps: ["corpus", "cours", "revision"],
    result:
      "Une séance interactive tirée de vos documents, animée en direct, révisée ensuite par chacun.",
    comfort: "Vous préparez moins, vos participants retiennent plus.",
    card: `<div class="carte-tete"><b>Question 2 sur 6</b><span>En direct, 24 participants</span></div>
      <p class="question">Quel facteur limite le plus la photosynthèse en ville ?</p>
      <ul class="votes"><li style="--v:62%"><span>La lumière</span></li><li style="--v:27%"><span>La chaleur</span></li><li style="--v:11%"><span>Le CO₂</span></li></ul>`,
  },
  {
    id: "produit",
    intent: "Faire évoluer mon produit",
    apps: ["tickets", "prototype", "docs"],
    result:
      "Une demande devenue prototype essayé, puis spécification relue, sans rien perdre en route.",
    comfort: "On décide sur du concret, pas sur des suppositions.",
    card: `<ol class="etapes-carte"><li>${tick}<b>Demande</b><span>« Pouvoir dupliquer un modèle »</span></li><li>${tick}<b>Prototype essayé</b><span>sur votre propre code</span></li><li>${tick}<b>Spécification relue</b><span>prête à construire</span></li></ol>`,
  },
  {
    id: "retrouver",
    intent: "Retrouver ce que je sais",
    apps: ["recherche", "notes", "wiki", "mail"],
    result:
      "La réponse, retrouvée dans vos notes, votre wiki ou vos e-mails, avec l'endroit d'où elle vient.",
    comfort: "Votre mémoire de travail cesse de dépendre de votre mémoire.",
    card: `<div class="recherche-champ">Où avions-nous décidé du budget du salon ?</div>
      <ul class="trouves"><li><b>Note du 12 mars</b><span>« Budget validé en réunion »</span><i>Libre Notes</i></li><li><b>Page Événements</b><span>Section budget</span><i>Libre Wiki</i></li><li><b>E-mail de Claire</b><span>Confirmation du devis</span><i>Libre Mail</i></li></ul>`,
  },
  {
    id: "automatiser",
    intent: "Automatiser sans perdre la main",
    apps: ["assistant", "automates", "routeur"],
    result:
      "Des enchaînements testés avant d'être activés, et un assistant qui demande avant d'agir.",
    comfort: "Le travail répétitif disparaît, le contrôle reste.",
    card: `<ol class="flux-carte"><li>Nouvelle facture reçue</li><li>Extraire montant et échéance</li><li class="attente">Validation demandée<span>Payer 480 € à l'imprimerie ?</span></li><li>Classer et prévenir la compta</li></ol>`,
  },
  {
    id: "reprise",
    intent: "Me relever d'un incident",
    apps: ["sauvegarde", "coffre", "vpn"],
    result:
      "Vos données restaurées et vérifiées, vos accès révoqués et rétablis, sans dépendre d'un tiers.",
    comfort: "Une panne devient un contretemps, pas une catastrophe.",
    card: `<div class="carte-tete"><b>Restauration de l'ordinateur portable</b><span>Terminée</span></div>
      <div class="barre"><span></span></div>
      <ul class="liste">${["Fichiers comparés à l'original : identiques", "Mots de passe rétablis depuis le coffre", "Ancien appareil révoqué"].map((d) => `<li>${tick}${d}</li>`).join("")}</ul>`,
  },
];

export interface Step {
  id: string;
  name: string;
  plain: string;
  detail: readonly string[];
}

export const chain: readonly Step[] = [
  {
    id: "intention",
    name: "Intention",
    plain: "Un besoin, exprimé une seule fois, par n'importe qui.",
    detail: [
      "Demandes publiques sur la forge",
      "Besoin décrit, critères de réussite écrits avant le code",
    ],
  },
  {
    id: "fabrique",
    name: "Fabrique",
    plain: "Des agents construisent, sous mission, et sont relus.",
    detail: [
      "Missions suivies de bout en bout",
      "Relecture par deux familles de modèles",
      "Décision humaine aux points qui comptent",
    ],
  },
  {
    id: "harness",
    name: "Harnais",
    plain: "Des garde-fous que personne ne peut contourner.",
    detail: [
      "Bac à sable : un contrôle impossible bloque, il n'avertit pas",
      "Identité et droits limités pour chaque agent",
      "Preuves rejouables, journal signé",
    ],
  },
  {
    id: "briques",
    name: "Briques",
    plain: "Des composants partagés, écrits une fois pour toutes.",
    detail: [
      "Cœurs en Rust, applications en TypeScript",
      "Contrats et formats communs, signés",
      "Formats ouverts : docx, xlsx, pdf, ics…",
    ],
  },
  {
    id: "applications",
    name: "Applications",
    plain: "La gamme Libre, sur ordinateur, sur le web, dans le navigateur.",
    detail: [
      "Applications de bureau légères",
      "Web et extensions",
      "Chaque application parle aux autres",
    ],
  },
  {
    id: "resultat",
    name: "Résultat",
    plain: "Ce que vous obtenez : le travail fait, pas l'outil.",
    detail: ["Un corpus, un compte rendu, une séance, une vidéo", "Exportable à tout moment"],
  },
  {
    id: "confort",
    name: "Confort",
    plain: "Rien à louer, rien de caché, tout se reprend.",
    detail: [
      "Vos données chez vous ou en Europe",
      "Aucun abonnement imposé",
      "Vous partez quand vous voulez, avec tout",
    ],
  },
];

export const pillars = [
  {
    title: "À vous",
    text: "Vos données restent chez vous ou en Europe. Vous exportez tout, à tout moment.",
  },
  {
    title: "Vérifiable",
    text: "Le code est public et chaque garantie se rejoue. Vous n'avez pas à nous croire sur parole.",
  },
  {
    title: "En commun",
    text: "Bâti une fois, partagé par tous. Chaque amélioration profite à chacun.",
  },
] as const;

export const commons = [
  {
    title: "Libre, pour de vrai",
    text: "Tout le code est public, sous licences EUPL et Apache. Personne ne pourra le refermer.",
  },
  {
    title: "Gouverné à découvert",
    text: "Chaque décision est écrite, datée et publique. Vous voyez pourquoi, pas seulement quoi.",
  },
  {
    title: "Sans module réservé",
    text: "Le commun est complet. Qui a besoin d'aide paie un service, jamais une fonctionnalité.",
  },
] as const;
