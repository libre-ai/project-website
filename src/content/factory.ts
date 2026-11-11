// Guided tour ("suivre une demande") and layer explorer content for the v4 prototype.
// Facts come from the roadmap and the forge/harness synthesis of 2026-11-09; wording is plain.
// Ported unchanged from the prototype accepted on 2026-11-09. Scenes are trusted authored HTML,
// their inline styles hoisted into classes at build time (src/web/hoist.ts).

export interface TourStep {
  id: string;
  title: string;
  lead: string;
  scene: string;
}

const ok = '<span class="pastille-ok" aria-hidden="true"></span>';
const ko = '<span class="pastille-ko" aria-hidden="true"></span>';

export const tour: readonly TourStep[] = [
  {
    id: "intention",
    title: "Quelqu'un exprime un besoin",
    lead: "Une personne écrit ce qui lui manque. Avant toute ligne de code, la fabrique écrit avec elle ce que « réussi » veut dire.",
    scene: `<div class="bulle">« Je veux un compte rendu de mes réunions, avec les décisions et qui fait quoi. »</div>
      <ul class="criteres"><li>${ok}Le compte rendu cite qui a dit quoi</li><li>${ok}Chaque action a une personne responsable</li><li>${ok}Rien ne quitte votre machine sans accord</li></ul>`,
  },
  {
    id: "fabrique",
    title: "Des agents se mettent au travail",
    lead: "La demande devient une mission. Des agents IA construisent, chacun sur sa tâche, et deux familles de modèles différentes relisent tout.",
    scene: `<div class="tableau-mission">
      <div><p>À faire</p><span class="tache">Exporter en .docx</span></div>
      <div><p>En cours</p><span class="tache agent">Transcrire la réunion</span><span class="tache agent">Extraire les décisions</span></div>
      <div><p>Relu</p><span class="tache relue">Lire l'agenda<small>2 familles de modèles</small></span></div>
    </div>`,
  },
  {
    id: "harnais",
    title: "Les garde-fous tiennent",
    lead: "Chaque agent a une identité et des droits limités. Ce qu'il ne peut pas faire est bloqué avant d'arriver, pas signalé après coup.",
    scene: `<ol class="journal">
      <li>${ok}<b>Agent transcription</b> lit l'audio de la réunion <i>autorisé</i></li>
      <li class="bloque">${ko}<b>Agent transcription</b> envoie l'audio vers un serveur inconnu <i>bloqué par le bac à sable</i></li>
      <li>${ok}<b>Agent décisions</b> écrit le compte rendu <i>autorisé</i></li>
      <li class="preuve"><b>Preuve signée</b> ajoutée au journal, rejouable par n'importe qui</li>
    </ol>`,
  },
  {
    id: "briques",
    title: "Les briques s'assemblent",
    lead: "Rien n'est réinventé : la transcription, l'agenda, l'export, l'autorisation existent déjà comme briques partagées, écrites une fois pour toutes.",
    scene: `<div class="pile-briques">${["Transcription locale", "Agenda (.ics)", "Export .docx", "Autorisation", "Contrats signés"].map((b, i) => `<span style="--i:${i}">${b}</span>`).join("")}</div>`,
  },
  {
    id: "application",
    title: "Libre Réunion prend son envol",
    lead: "Les briques deviennent une application qui parle déjà aux autres : votre agenda, votre visio, vos tâches.",
    scene: `<div class="constellation-app" data-oiseaux="reunion agenda visio taches"></div>`,
  },
  {
    id: "resultat",
    title: "Vous obtenez le résultat",
    lead: "Un compte rendu relu, des décisions nettes, des actions confiées. C'est ce que vous vouliez, pas un outil de plus à apprendre.",
    scene: `<div class="resultat-mini"><b>Comité projet, compte rendu</b><ul><li>${ok}Décision : lancer la bêta</li><li>${ok}Action : Claire prépare l'annonce</li><li>${ok}Action : Karim ouvre l'accès testeurs</li></ul></div>`,
  },
  {
    id: "pour-tous",
    title: "Et désormais, pour tous",
    lead: "Ce qui a été construit pour une personne devient un commun : tous ceux qui avaient le même besoin en profitent, sans le réinventer.",
    scene: `<div class="pour-tous">${Array.from({ length: 24 }, (_, i) => `<span style="--i:${i}"></span>`).join("")}<p>Chez vous. Exportable. Sans abonnement.</p></div>`,
  },
];

export interface Layer {
  id: string;
  name: string;
  question: string;
  answer: string;
  mechanisms: readonly string[];
  tech: readonly string[];
  links: readonly string[];
}

export const layers: readonly Layer[] = [
  {
    id: "applications",
    name: "Applications",
    question: "Qu'est-ce que j'utilise ?",
    answer:
      "La volée Libre : des applications légères qui se parlent, sur ordinateur, sur le web et dans le navigateur.",
    mechanisms: [
      "Chaque application vend un résultat, pas un abonnement",
      "Données exportables à tout moment",
      "Fonctionne chez vous ou en Europe",
    ],
    tech: ["Tauri", "Web", "Extensions"],
    links: ["briques", "identite"],
  },
  {
    id: "briques",
    name: "Briques",
    question: "De quoi sont-elles faites ?",
    answer:
      "De composants partagés, écrits une seule fois et réutilisés partout : c'est ainsi qu'on cesse de réinventer.",
    mechanisms: [
      "Cœurs rapides et sûrs",
      "Formats ouverts : docx, xlsx, pdf, ics",
      "Contrats communs entre briques",
    ],
    tech: ["Rust", "TypeScript", "Bun"],
    links: ["applications", "preuve"],
  },
  {
    id: "identite",
    name: "Identité",
    question: "Qui a le droit de faire quoi ?",
    answer:
      "Chaque humain, chaque agent, chaque service a une identité et des droits limités, qui ne font que se restreindre en passant de main en main.",
    mechanisms: [
      "Un agent n'agit jamais sous le jeton d'un humain",
      "Droits atténués à chaque délégation",
      "Révocation par agent",
    ],
    tech: ["Biscuit", "OIDC"],
    links: ["harnais", "applications"],
  },
  {
    id: "confinement",
    name: "Bac à sable",
    question: "Et si un agent dérape ?",
    answer:
      "Il travaille enfermé. Ce qui n'est pas explicitement permis est refusé avant exécution, jamais signalé après coup.",
    mechanisms: [
      "Un contrôle impossible bloque, il n'avertit pas",
      "Aucun secret monté",
      "Sorties sur liste blanche",
    ],
    tech: ["Confinement Linux", "Liste blanche réseau"],
    links: ["harnais", "preuve"],
  },
  {
    id: "harnais",
    name: "Harnais",
    question: "Comment les agents sont-ils encadrés ?",
    answer:
      "Par un harnais de règles et de contrôles automatiques que chaque changement doit franchir, avec des preuves qui s'exécutent.",
    mechanisms: [
      "Contrôles de flotte sur chaque dépôt",
      "Compétences d'agent gouvernées",
      "Preuve exécutable plutôt que déclaration",
    ],
    tech: ["Gates CI", "Tests de mutation"],
    links: ["fabrique", "confinement", "identite"],
  },
  {
    id: "fabrique",
    name: "Fabrique",
    question: "Qui construit ?",
    answer:
      "Des agents IA, sous mission, relus par une seconde famille de modèles, avec une décision humaine aux points qui comptent.",
    mechanisms: [
      "Besoin et critères écrits avant le code",
      "Missions suivies de bout en bout",
      "Relecture par deux familles de modèles",
    ],
    tech: ["Agents", "Missions", "Revue croisée"],
    links: ["harnais", "gouvernance"],
  },
  {
    id: "preuve",
    name: "Preuve",
    question: "Comment le vérifier ?",
    answer:
      "Tout se rejoue : chaque résultat important est signé et consigné dans un journal que n'importe qui peut relire.",
    mechanisms: [
      "Journal chaîné, ajout seul",
      "Signatures vérifiables par un tiers",
      "Une version publiée ne se republie jamais",
    ],
    tech: ["DSSE", "in-toto"],
    links: ["gouvernance", "briques"],
  },
  {
    id: "gouvernance",
    name: "Gouvernance",
    question: "Qui décide des règles ?",
    answer:
      "Des règles écrites, publiques et datées, décidées avant le code. Vous voyez pourquoi, pas seulement quoi.",
    mechanisms: [
      "Invariants publics",
      "Décisions datées et signées",
      "Licences libres : EUPL, Apache, CC-BY",
    ],
    tech: ["ADR", "Registre de décisions"],
    links: ["fabrique", "preuve"],
  },
];
