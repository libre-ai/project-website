# ADR 0010 — Refonte : papier plié, trois pages, l'état réel de chaque application

- **Statut** : proposé. Les décisions qu'il consigne ont été prises par le propriétaire les
  2026-11-23 et 2026-11-24, sur un prototype jetable jugé en version 17 et par questions
  structurées ; le texte de cet ADR est accepté à la fusion.
- **Portée** : site public `libre-ia.fr`.
- **Amende** :
  - ADR 0004, décisions 2 (palette), 4 (polices) et 5 (40 logos) ;
  - ADR 0005, décision 5 (effets retenus) ;
  - ADR 0007, décisions 1 (promesse), 3 (aucun état), 5 (applications), 7 (parcours), 8 (premier
    écran) et 10 (pages).

  Tout le reste de ces ADR est inchangé, en particulier :
  - ADR 0004 §3 (contraste prouvé), §6 (sprite) et ses conditions avant publication ;
  - ADR 0005 §1 à §4 et §6 à §8 (site complet sans script, un seul module, aucune requête,
    mouvement réduit, budget, aucun `<canvas>`) ;
  - ADR 0007 §2 (aucun produit présenté comme disponible), §4 (illustrations marquées) et §9.

## Contexte

Le 2026-11-23, le propriétaire a jugé le site « terriblement laid », pauvre en information utile
et peu animé. Il a choisi quatre orientations :

- une nouvelle direction artistique, qui garde le martinet ;
- la vision accompagnée de l'état calculé de chaque application ;
- deux niveaux de lecture ;
- un récit animé, marqué « Illustration ».

Un prototype jetable a été itéré sur dix-sept versions, chacune jugée sur pièce. Sur
l'accueil, il a retenu trois sections redessinées à partir de situations d'entreprise réelles,
validées sous forme d'esquisses fixes avant toute animation : l'ordre de mission d'un agent, le
même virement pour l'agent et le dirigeant, et l'application livrée démontée en ses pièces.
Les textes ont été tranchés un à un.

Le schéma directeur d'un autre dépôt du propriétaire a inspiré des formes de présentation, et
seulement elles : modèle en une ligne, histoire en images, principes « compromis retiré +
mécanisme ». Aucun texte, aucune donnée, aucun cas, aucun nom ni aucun élément de DA n'en vient.
Ce dépôt l'a décidé de son côté (D243).

## Décision

1. **Palette (amende 0004 §2).** Papier et nuit :
   - fond papier `#fbfaf7` ;
   - ouverture en nuit `#15213b` ;
   - encre `#15213b`.

   Quatre couleurs de rôle désignent qui agit, de l'accueil jusqu'au détail :

   | Rôle | Couleur |
   | --- | --- |
   | personne | ambre `#875000` |
   | agent | bleu `#1f5bb5` |
   | contrôle | vert `#1b6e45` |
   | incident | brique `#a8291f` |

   Le mode clair reste le mode par défaut, et le sombre sa variante. Les couleurs d'univers
   gardent une luminance et une chroma communes en OKLCH.

   Les valeurs exactes des jetons, clair et sombre, vivent dans `src/design/palette.ts`. Le
   contraste de chaque paire y est prouvé par le test de l'ADR 0004 §3, inchangé.
2. **Polices (amende 0004 §4).** Toutes auto-hébergées sous OFL-1.1, avec leur licence :
   - Literata pour les titres ;
   - Atkinson Hyperlegible Next pour le texte, dessinée pour la basse vision ;
   - Caveat pour les seules annotations manuscrites des illustrations.

   Aucune police distante.
3. **Logos (amende 0004 §5).** Il y a 41 applications, donc 41 oiseaux. P41 est une mésange
   posée sur un pique-notes. Les conditions de l'ADR 0004 avant publication s'appliquent aussi
   à ce nouveau dessin.
4. **Mouvements (amende 0005 §5).** Les effets retenus sont les suivants :
   - **pliage d'une application** : à l'ouverture, une feuille se plie en l'icône d'une
     application, faite des pièces de son oiseau. Chaque pièce se rabat sur l'arête qu'elle
     partage avec une autre, sinon elle se couche ;
   - **ordre de mission** : une ligne refusée se rabat sur son pli, puis se repose à plat sur
     son revers, son texte lisible et la règle qui l'a arrêtée en marge ; le talon se détache ;
   - **virement** : les deux demandes sont les deux moitiés d'une feuille, qui s'ouvre sur son
     pli central jusqu'à se poser à plat ;
   - **vue éclatée** : les pièces de l'application livrée sortent au repos et se rangent dans
     l'icône au toucher ;
   - les micro-interactions de l'ADR 0005 §5 sont gardées : thème, onglets, accordéons.

   Trois règles valent pour tous les mouvements :
   - au repos, aucun texte ne reste sur une face inclinée ; un pli se voit par un trait
     pointillé et une ombre ;
   - le résultat d'une règle n'est jamais écrit à la main : il est calculé par une fonction
     pure, au build, pour chaque service. Sans script, toutes les feuilles s'affichent à plat ;
     le module client n'en montre qu'une à la fois et ne recalcule rien (précision du
     2026-11-25, à la mise en page de l'ordre de mission : le texte d'origine faisait aussi
     calculer le module client au choix d'un service, ce qui aurait recopié dans le module les
     règles et les situations déjà calculées au build) ;
   - les vues sans script montrent le même contenu, à plat.

   La silhouette « Seul / Ensemble » et la visite guidée sont retirées.
5. **Promesse (amende 0007 §1).**
   - Accroche : « Possédez la fabrique. ».
   - Sous-titre : « Toute la chaîne pour produire avec l'IA et transformer votre entreprise.
     Vos données, vos règles, vos agents. ».
   - Devise, gardée : « Ce que chacun réinvente seul, faisons-le ensemble. ».
   - Le public est l'entreprise ; les applications sont ce que la chaîne produit.
6. **État réel (amende 0007 §3).** Chaque application montre son état, du moins avancé au plus
   avancé : idée, en préparation, en construction, avant-première, publiée.
   - L'état est calculé au build, par un script, depuis les fiches de gouvernance épinglées et
     leurs preuves. Il n'est jamais saisi.
   - Une source illisible fait échouer le build. Elle n'est jamais lue comme un état bas.
   - Les compteurs restent interdits (nombre d'applications, de dépôts, pourcentages).
   - Le contrôle des formulations de disponibilité reste en place. L'état et le §2 se
     tiennent ensemble : un état qui n'est pas « publiée » ne propose ni installation ni
     téléchargement.
7. **Applications (amende 0007 §5).** 41 applications, de P01 à P41.
   - Noms tranchés : Sources (P01), Biblio (P03, qui remplace Corpus), Canevas (P14),
     Tempo (P28), Antenne (P29), Cours (P39).
   - Noms provisoires : Remontées (P15) et Tickets (P41), comme les autres noms provisoires.
   - Les noms suivent les fiches de `project-governance`.
8. **Accueil (amende 0007 §7 et §8).** De haut en bas :
   - ouverture : accroche et planche de pliage ;
   - quatre moments : « De votre besoin à l'application livrée » ;
   - ordre de mission : « Ce qu'un agent tente, et ce qui l'arrête. » ;
   - avant / après, à l'horizontale même sur téléphone ;
   - applications par univers ;
   - virement : « Une règle ne connaît pas de chef. » ;
   - vue éclatée ;
   - preuves, trois questions, puis trois façons de commencer.
9. **Pages (amende 0007 §10).** Le menu porte trois pages : Accueil, Applications, et Méthode
   sous `/methode/`.
   - Méthode a pour titre « Les règles, et comment les vérifier ». Elle reprend la méthode
     aujourd'hui fusionnée dans « À propos ».
   - Les pages de transparence sont conservées hors du menu, joignables depuis le pied de
     page : preuves, corrections, licences, déployer, signaler, une page par brique de la
     forge, confidentialité, liste d'attente.

## Conséquences

- **Tests à réécrire, avec les surfaces qu'ils figent :**
  - palette et polices (`src/design/palette.test.ts`, `src/font.test.ts`) ;
  - les 40 applications (`src/content/*.test.ts`, `src/brand/sprite.ts`,
    `src/brand/*.test.ts`, `server/subscription.test.ts`), avec la politique du serveur
    régénérée et la parité Rust/Bun réenregistrée (ADR 0009) ;
  - le premier écran et la visite (`src/web/routes.test.ts`, `e2e/site.e2e.ts`) ;
  - l'interdiction de `/methode/` comme ancienne route ;
  - les captures de référence (`e2e/visual.e2e.ts`).

  Un test réécrit l'est depuis cet ADR, pas depuis la sortie du nouveau code.
- **Gates inchangés :**
  - budgets de poids : `main.js` 16 KiB, `site.css` 48 KiB, page 120 KiB gzip ;
  - CSP ;
  - aucun style en ligne ;
  - déterminisme ;
  - formulations interdites et G9.

  Si une mesure au build dépasse un budget, ce budget s'amende par un ADR qui cite la mesure.
- **Ce qui reste interdit :** une mise en ligne qui présente la vision cible comme livrée. Les
  textes de la vision s'écrivent comme une intention, et l'état calculé dit ce qui existe.
- **Conditions avant publication :**
  - toutes celles de l'ADR 0004 (antériorité, revue de similarité du martinet et des 41
    dessins) ;
  - la revue de similarité des noms ;
  - les deux points bloquants de l'ADR 0009.
