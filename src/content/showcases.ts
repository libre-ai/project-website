// What each Libre application does, shown ArtCraft-style: a plain function label, three concrete
// tags and an animated micro-demo (an illustration of the intended result, I-15).
// Ported unchanged from the v4 prototype accepted on 2026-11-09 and keyed by its internal words;
// `showcaseOf` reads them by application reference. Demos are authored HTML, trusted repository
// content: their inline styles are hoisted into classes at build time (src/web/hoist.ts).
import { PROTOTYPE_KEY_OF } from "./prototype-keys";

export interface Showcase {
  category: string;
  tags: readonly [string, string, string];
  demo: string;
}

const i = (n: number): string => `style="--i:${n}"`;
const ok = '<span class="d-ok a-check"></span>';
const line = (w: number, n = 0, cls = ""): string =>
  `<span class="d-ligne a-in ${cls}" style="--i:${n};--w:${w}%"></span>`;
const chip = (t: string, n = 0, cls = ""): string =>
  `<span class="d-puce a-in ${cls}" ${i(n)}>${t}</span>`;
const row = (title: string, sub: string, n: number, cls = ""): string =>
  `<div class="d-rang a-in ${cls}" ${i(n)}><b>${title}</b><small>${sub}</small></div>`;

export const showcases: Readonly<Record<string, Showcase>> = {
  // Connaissance
  sources: {
    category: "Exploration du web sourcée",
    tags: ["Sources attribuées", "Pages lues ou non lues", "Citation exportable"],
    demo: `<div class="d-graphe"><svg viewBox="0 0 200 110"><path class="a-trace" d="M30 55 L90 25 M30 55 L95 80 M90 25 L160 20 M95 80 L165 70 M90 25 L165 70"/></svg>
      <span class="d-noeud centre a-in" style="--i:0;left:15%;top:50%">Votre question</span>
      <span class="d-noeud a-in" style="--i:2;left:45%;top:22%">Rapport ADEME</span><span class="d-noeud a-in" style="--i:3;left:47%;top:73%">Article HAL</span>
      <span class="d-noeud ok a-in" style="--i:4;left:80%;top:18%">Lu ✓</span><span class="d-noeud a-in" style="--i:5;left:82%;top:64%">Non lu</span></div>`,
  },
  veille: {
    category: "Lecteur de flux et veille",
    tags: ["Flux RSS et sites", "Tri par vos questions", "Pourquoi le lire"],
    demo: `${row("Étude sur les sols urbains", "Pourquoi : répond à « îlots de chaleur »", 0, "a-surligne")}${row("Communiqué de presse", "Écarté : sans rapport", 1, "a-pale")}${row("Norme NF mise à jour", "Pourquoi : modifie une note", 2, "a-surligne")}${row("Billet promotionnel", "Écarté : doublon", 3, "a-pale")}`,
  },
  corpus: {
    category: "Assistant de bibliothèque Zotero",
    tags: ["Connecté à Zotero", "Références et citations", "Nettoyage du corpus"],
    demo: `<div class="d-graphe"><svg viewBox="0 0 200 110"><path class="a-trace" d="M100 55 L40 25 M100 55 L45 88 M100 55 L160 28 M100 55 L158 85"/></svg>
      <span class="d-noeud centre a-in" style="--i:0;left:50%;top:50%">Votre article</span>
      <span class="d-noeud a-in" style="--i:1;left:20%;top:22%">Cité par 12</span><span class="d-noeud a-in" style="--i:2;left:22%;top:80%">Méthode proche</span>
      <span class="d-noeud ko a-in" style="--i:3;left:80%;top:25%">Hors sujet : archiver ?</span><span class="d-noeud ok a-in" style="--i:4;left:80%;top:78%">À lire ensuite</span></div>`,
  },
  notes: {
    category: "Prise de notes",
    tags: ["Markdown", "Liens entre notes", "Export à tout moment"],
    demo: `<div class="d-doc"><b class="a-in" ${i(0)}>Idées atelier compost</b>${line(90, 1)}${line(70, 2)}<span class="d-lien a-in" ${i(3)}>→ Calendrier des ateliers</span>${line(80, 4)}<div class="d-etiquettes">${chip("#jardin", 5)}${chip("#asso", 6)}</div></div>`,
  },
  wiki: {
    category: "Wiki d'équipe",
    tags: ["Pages liées", "Historique des versions", "Qui a écrit quoi"],
    demo: `<div class="d-doc"><b class="a-in" ${i(0)}>Procédure d'accueil</b>${line(85, 1)}<span class="d-ligne a-in a-surligne" style="--i:2;--w:75%"></span>${line(60, 3)}<span class="d-bulle a-in" ${i(4)}>Mis à jour par Claire · v12</span></div>`,
  },
  recherche: {
    category: "Recherche dans toutes vos applications",
    tags: ["Notes, e-mails, fichiers", "Sans mélanger les données", "Source affichée"],
    demo: `<div class="d-champ a-tape">budget du salon</div>${row("Note du 12 mars", "Libre Notes", 1)}${row("Page Événements", "Libre Wiki", 2)}${row("E-mail de Claire", "Libre Mail", 3)}`,
  },
  revision: {
    category: "Cartes de révision",
    tags: ["Répétition espacée", "Cartes depuis vos sources", "Progression suivie"],
    demo: `<div class="d-flashcard"><div class="face recto">Qu'est-ce qu'un îlot de chaleur ?</div><div class="face verso">Une zone urbaine plus chaude que ses alentours.</div></div><div class="d-etiquettes centre">${chip("À revoir dans 3 jours", 2)}</div>`,
  },
  // Bureautique et données
  docs: {
    category: "Traitement de texte",
    tags: [".docx, .odt, .pdf", "Relecture à plusieurs", "Suivi des modifications"],
    demo: `<div class="d-doc"><b class="a-in" ${i(0)}>Rapport d'activité 2026</b>${line(92, 1)}<span class="d-ligne a-in d-insere" style="--i:2;--w:70%"></span>${line(85, 3)}<span class="d-bulle a-in" ${i(4)}>Karim : « Ajouter les chiffres de mars ? »</span></div><span class="d-export a-in" ${i(5)}>Exporter en .docx</span>`,
  },
  tableur: {
    category: "Tableur",
    tags: [".xlsx et .ods", "Calculs expliqués", "Résultats reproductibles"],
    demo: `<div class="d-grille">${["Mois", "Recettes", "Dépenses", "Jan.", "1 200", "800", "Fév.", "1 450", "900", "Total", "", ""].map((c, k) => `<span class="${k === 10 ? "cible" : ""}">${c}</span>`).join("")}<span class="d-calcul a-in" ${i(1)}>2 650</span></div><span class="d-bulle a-in" ${i(3)}>= Recettes de janvier + février, 2 cellules</span>`,
  },
  diapos: {
    category: "Présentations",
    tags: [".pptx et PDF", "Thème cohérent", "Mode présentateur"],
    demo: `<div class="d-diapos"><div class="miniatures">${[0, 1, 2].map((k) => `<span class="a-actif" style="--i:${k}"></span>`).join("")}</div><div class="principale"><b class="a-in" ${i(0)}>Bilan de l'année</b><div class="d-barres">${[40, 65, 90].map((h, k) => `<span class="a-barre-v" style="--i:${k + 1};--h:${h}%"></span>`).join("")}</div></div></div>`,
  },
  fichiers: {
    category: "Stockage et partage de fichiers",
    tags: ["Synchronisation", "Partage révocable", "Versions conservées"],
    demo: `${row("Statuts de l'asso.pdf", "Synchronisé sur 3 appareils", 0)}${row("Photos AG 2026", "Partagé avec 4 personnes", 1, "a-surligne")}<div class="d-etiquettes">${chip("Partage révoqué", 3, "ko")}${chip("Version 7 restaurée", 4)}</div>`,
  },
  pdf: {
    category: "Atelier PDF et numérisation",
    tags: ["Reconnaissance du texte", "Annoter, fusionner", "Original intact"],
    demo: `<div class="d-doc d-scan"><span class="d-balayage"></span>${line(80, 0)}${line(90, 1)}<span class="d-ligne a-in a-surligne" style="--i:2;--w:60%"></span>${line(75, 3)}</div><span class="d-export a-in" ${i(4)}>Texte reconnu, recherchable</span>`,
  },
  formulaires: {
    category: "Formulaires et bases de données",
    tags: ["Formulaire public", "Règles de validation", "Tableau des réponses"],
    demo: `<div class="d-form"><label class="a-in" ${i(0)}>Nom<span class="a-tape">Inès Martin</span></label><label class="a-in" ${i(1)}>Atelier<span class="a-tape">Compost, samedi</span></label></div><div class="d-grille petite">${["Nom", "Atelier", "Inès Martin", "Compost"].map((c, k) => `<span class="${k > 1 ? "a-in" : ""}" style="--i:${k + 2}">${c}</span>`).join("")}</div>`,
  },
  canevas: {
    category: "Tableau blanc et diagrammes",
    tags: ["Toile infinie", "Notes et liens", "Décisions en tâches"],
    demo: `<div class="d-toile"><svg viewBox="0 0 200 110"><path class="a-trace" d="M50 30 C 90 30, 90 70, 130 70 M50 30 C 80 80, 60 90, 60 90"/></svg><span class="d-postit a-in" style="--i:0;left:10%;top:12%">Idée : marché local</span><span class="d-postit b a-in" style="--i:1;left:55%;top:52%">Qui s'en charge ?</span><span class="d-postit c a-in" style="--i:2;left:12%;top:68%">Budget</span><span class="d-puce a-in ok" style="--i:4;position:absolute;right:6%;top:12%">→ Tâche créée</span></div>`,
  },
  // Collaboration
  tickets: {
    category: "Tickets et support",
    tags: ["Doublons détectés", "Responsable désigné", "Résolution vérifiée"],
    demo: `<div class="d-kanban"><div><p>Nouveau</p></div><div><p>En cours</p></div><div><p>Résolu</p></div><span class="d-ticket a-bouge" style="--tx:200%">#142 Export lent</span></div>`,
  },
  taches: {
    category: "Liste de tâches",
    tags: ["Saisie en un geste", "Rappel au bon moment", "Sans projet à gérer"],
    demo: `${["Rappeler la mairie", "Envoyer le compte rendu", "Réserver la salle"].map((t, k) => `<div class="d-tache a-in" ${i(k)}><span class="d-case a-coche" style="--i:${k + 2}"></span>${t}</div>`).join("")}<div class="d-etiquettes">${chip("Demain 9 h", 4)}</div>`,
  },
  mail: {
    category: "Messagerie électronique",
    tags: ["Vos comptes", "Recherche fiable", "Envoi vérifié"],
    demo: `${row("Claire · Devis traiteur", "À répondre aujourd'hui", 0, "a-surligne")}${row("Lettre d'info", "Rangée dans Lectures", 1, "a-pale")}${row("Karim · Planning", "À répondre", 2, "a-surligne")}${row("Publicité", "Archivée", 3, "a-pale")}`,
  },
  visio: {
    category: "Messagerie d'équipe et visio",
    tags: ["Salons par projet", "Appels vidéo", "Décisions retrouvables"],
    demo: `<div class="d-visio">${["CJ", "AL", "KM", "IM"].map((p, k) => `<span class="${k === 1 ? "parle" : ""}">${p}</span>`).join("")}</div><div class="d-etiquettes">${chip("Décision épinglée", 2, "ok")}</div>`,
  },
  agenda: {
    category: "Agenda partagé",
    tags: ["Format .ics", "Créneau commun trouvé", "Détails privés masqués"],
    demo: `<div class="d-agenda">${Array.from({ length: 15 }, (_, k) => `<span class="${[1, 4, 6, 8, 13].includes(k) ? "pris" : k === 10 ? "trouve" : ""}"></span>`).join("")}</div><span class="d-bulle a-in" ${i(2)}>Jeudi 14 h : libre pour les 4 participants</span>`,
  },
  relations: {
    category: "Contacts et suivi relationnel",
    tags: ["Carnet de contacts", "Historique des échanges", "Prochaine relance"],
    demo: `<div class="d-contact a-in" ${i(0)}><span class="avatar">IM</span><div><b>Inès Martin</b><small>Association Les Jardins</small></div></div>${row("12 mars · Réunion", "Projet compost", 1)}${row("2 avril · E-mail", "Devis envoyé", 2)}<div class="d-etiquettes">${chip("Relancer le 15 avril", 3)}</div>`,
  },
  reunion: {
    category: "Assistant de réunion",
    tags: ["Transcription locale", "Décisions et actions", "Compte rendu relu"],
    demo: `<div class="d-onde">${Array.from({ length: 22 }, (_, k) => `<span style="--k:${k}"></span>`).join("")}</div><div class="d-tache a-in" ${i(2)}>${ok}Décision : lancer la bêta</div><div class="d-tache a-in" ${i(3)}>${ok}Action : Claire prépare l'annonce</div>`,
  },
  // Création et publication
  video: {
    category: "Montage vidéo",
    tags: ["Montage sur la ligne de temps", "Sous-titres", "Export ouvert"],
    demo: `<div class="d-ecran"><span class="d-lecture"></span></div><div class="d-timeline"><span style="--w:30%"></span><span style="--w:22%"></span><span style="--w:35%"></span><i class="d-tete"></i></div>`,
  },
  prototype: {
    category: "Prototypage produit",
    tags: ["Depuis votre code", "Composants réutilisés", "Spécification transmise"],
    demo: `<div class="d-proto"><div class="maquette"><span class="a-in" ${i(0)}></span><span class="a-in" ${i(1)}></span><span class="bouton a-pulse">Dupliquer</span></div><i class="d-curseur a-bouge" style="--tx:120%;--ty:160%"></i></div><div class="d-etiquettes">${chip("Prototype essayé", 3, "ok")}${chip("Spécification prête", 4)}</div>`,
  },
  audio: {
    category: "Studio audio et podcast",
    tags: ["Enregistrer, couper", "Nettoyage du son", "Transcription"],
    demo: `<div class="d-onde grande">${Array.from({ length: 28 }, (_, k) => `<span style="--k:${k}"></span>`).join("")}</div><span class="d-bulle a-in" ${i(2)}>« Bienvenue dans l'épisode 3… »</span>`,
  },
  site: {
    category: "Création de sites",
    tags: ["Pages et navigation", "Aperçu avant publication", "Votre hébergement"],
    demo: `<div class="d-site"><span class="nav a-in" ${i(0)}></span><span class="banniere a-in" ${i(1)}></span><span class="col a-in" ${i(2)}></span><span class="col a-in" ${i(3)}></span></div><span class="d-export a-in" ${i(4)}>Publié sur votre domaine</span>`,
  },
  diffusion: {
    category: "Diffusion éditoriale",
    tags: ["Variantes par canal", "Programmation", "Vérifié avant envoi"],
    demo: `<div class="d-carte a-in" ${i(0)}><b>Nouvel épisode en ligne</b><small>Article source</small></div><div class="d-etiquettes">${chip("Lettre · mardi 9 h", 1)}${chip("Mastodon · mardi 10 h", 2)}${chip("Site · publié", 3, "ok")}</div>`,
  },
  ressources: {
    category: "Médiathèque créative",
    tags: ["Images, polices, sons", "Licence de chaque média", "Usages suivis"],
    demo: `<div class="d-galerie">${[0, 1, 2, 3, 4, 5].map((k) => `<span class="a-in" style="--i:${k};--h:${(k * 47) % 360}"></span>`).join("")}</div><div class="d-etiquettes">${chip("CC-BY · réutilisable", 3, "ok")}${chip("Utilisée dans 2 vidéos", 4)}</div>`,
  },
  // Médias et jeu
  tempo: {
    category: "Extension de lecture multimédia",
    tags: ["Vitesse, son, sous-titres", "Profils par site", "Navigateur"],
    demo: `<div class="d-ecran petit"><span class="d-lecture"></span></div><div class="d-reglages"><span class="d-vitesse">1× → 1,5×</span><span class="d-puce">Sous-titres FR</span><span class="d-puce">Son normalisé</span></div>`,
  },
  antenne: {
    category: "Lecteur vidéo et abonnements",
    tags: ["Vos chaînes", "Sans pistage", "Reprise de lecture"],
    demo: `${row("Atelier bois · nouvel épisode", "Chaîne suivie", 0, "a-surligne")}${row("Cuisine de saison", "Reprendre à 12:40", 1)}${row("Conférence climat", "Dans votre file", 2)}`,
  },
  lecture: {
    category: "Lecture de mangas, BD et livres",
    tags: ["CBZ, EPUB, PDF", "Sens de lecture", "Reprise sur tous les écrans"],
    demo: `<div class="d-livre"><span class="page gauche"></span><span class="page droite a-tourne"></span></div><div class="d-etiquettes centre">${chip("Chapitre 4 · page 12", 2)}</div>`,
  },
  mediatheque: {
    category: "Médiathèque personnelle",
    tags: ["Musique et vidéos", "Vos appareils", "Métadonnées corrigées"],
    demo: `<div class="d-pochettes">${[0, 1, 2, 3].map((k) => `<span class="a-in" style="--i:${k};--h:${120 + k * 50}"></span>`).join("")}</div><div class="d-timeline mince"><i class="d-tete"></i></div>`,
  },
  jdr: {
    category: "Compagnon de jeu de rôle",
    tags: ["Campagnes et personnages", "Dés et règles", "Journal de séance"],
    demo: `<div class="d-de a-tourne">17</div>${row("Séance 6 · la forêt d'Ombre", "Journal partagé", 1)}`,
  },
  // Maîtrise des outils
  routeur: {
    category: "Choix du modèle d'IA",
    tags: ["Règles par usage", "Conformité vérifiée", "Hébergement européen"],
    demo: `<div class="d-carte a-in" ${i(0)}><b>Résumer un dossier patient</b><small>Données de santé</small></div><div class="d-etiquettes">${chip("Modèle A · hors UE", 1, "ko")}${chip("Modèle B · non qualifié", 2, "ko")}${chip("Modèle C · local, autorisé", 3, "ok")}</div>`,
  },
  assistant: {
    category: "Assistant IA personnel",
    tags: ["Sources visibles", "Demande avant d'agir", "Permissions claires"],
    demo: `<div class="d-msg moi a-in" ${i(0)}>Classe mes factures de mars</div><div class="d-msg a-in" ${i(1)}>J'ai trouvé 7 factures. Je les range dans « Compta 2026 » ?</div><div class="d-choix a-in" ${i(2)}><span class="oui">Valider</span><span>Modifier</span></div>`,
  },
  automates: {
    category: "Automatisations entre applications",
    tags: ["Déclencheur et étapes", "Testé avant activation", "Journal d'exécution"],
    demo: `<div class="d-flux">${["Facture reçue", "Extraire le montant", "Validation ?", "Classer"].map((t, k) => `<span class="a-in ${k === 2 ? "attente" : ""}" ${i(k)}>${t}</span>`).join("")}</div>`,
  },
  vpn: {
    category: "VPN et accès privé",
    tags: ["Appareils enrôlés", "Règles explicites", "Révocation immédiate"],
    demo: `<div class="d-tunnel"><span class="appareil">Portable</span><span class="tube"><i></i></span><span class="appareil">Serveur maison</span></div><div class="d-etiquettes centre">${chip("Ancien téléphone révoqué", 2, "ko")}</div>`,
  },
  coffre: {
    category: "Coffre de mots de passe",
    tags: ["Chiffré chez vous", "Partage limité", "Récupération prévue"],
    demo: `${row("Banque", "••••••••••", 0)}${row("Mairie (asso)", "Partagé avec 2 personnes", 1, "a-surligne")}${row("Wi-Fi maison", "••••••••", 2)}<div class="d-etiquettes">${chip("Mot de passe faible remplacé", 3, "ok")}</div>`,
  },
  sauvegarde: {
    category: "Sauvegarde et restauration",
    tags: ["Restauration testée", "Plusieurs destinations", "Comparaison à l'original"],
    demo: `<div class="d-carte a-in" ${i(0)}><b>Restauration de l'ordinateur portable</b><small>Depuis la sauvegarde de cette nuit</small></div><div class="d-progression"><span class="a-barre"></span></div><div class="d-tache a-in" ${i(3)}>${ok}Fichiers identiques à l'original</div>`,
  },
  fenetres: {
    category: "Agencement des fenêtres",
    tags: ["Raccourcis clavier", "Plusieurs écrans", "Dispositions mémorisées"],
    demo: `<div class="d-fenetres"><span class="f1"></span><span class="f2"></span><span class="f3"></span></div>`,
  },
  // Pédagogie
  cours: {
    category: "Activités pédagogiques en direct",
    tags: ["Quiz et votes", "Depuis vos documents", "Séance en direct"],
    demo: `<b class="a-in" ${i(0)}>Quel facteur limite la photosynthèse en ville ?</b><div class="d-votes">${[
      ["La lumière", 62],
      ["La chaleur", 27],
      ["Le CO₂", 11],
    ]
      .map(([t, v], k) => `<span style="--v:${v}%;--i:${k}"><i class="a-barre"></i>${t}</span>`)
      .join("")}</div><div class="d-etiquettes">${chip("24 participants", 3)}</div>`,
  },
};

export function showcaseOf(ref: string): Showcase {
  const key = PROTOTYPE_KEY_OF[ref];
  const showcase = key === undefined ? undefined : showcases[key];
  if (showcase === undefined) throw new Error(`content.showcase_missing:${ref}`);
  return showcase;
}
