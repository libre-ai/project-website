# Rapport de recette locale, 2026-10-15

Tête mesurée : voir `git rev-parse HEAD` au moment du relevé (branche `work/website-refonte-v1`).
Mesures relevées le 2026-10-15, sans variable d'environnement, sur un arbre propre. Chaque
commande se rejoue ; aucune valeur n'est une appréciation. Les captures ne sont pas versionnées.

## 1. Gates G1 à G11

| Gate | Statut | Commande | Compteur relevé |
|---|---|---|---|
| G1 carte complète | atteint | `bun run build` | 13 pages fixes + 15 pages produit = 28 ; 48 fichiers écrits |
| G2 fiches pilotées par la source | atteint | `bun run build` | 15 fiches vérifiées contre leurs empreintes, 15 lues, 15 pages produit ; univers 15 / 15 |
| G3 gates bloquants | atteint avec écart (ADR 0003) | `bun run build` | limites : 15 fiches examinées, 0 violation ; ressources : 15 examinées, 0 violation ; le gate FR-02 est retiré par ADR 0003 |
| G4 découvrabilité | atteint | `bun test src/corpus.test.ts` | 28 URL de sitemap = 28 pages du corpus (égalité testée) |
| G5 e2e FR-01 à FR-16 | atteint avec écarts | `bunx playwright test` | 103 passés, 17 ignorés sur 4 projets (voir §4) |
| G6 accessibilité et en-têtes | atteint avec écart | `bunx playwright test` | axe : 0 `serious`/`critical` sur chaque route de la liste e2e ; CSP `script-src 'none'` testée ; défilement horizontal testé à 360, 390, 1440 px sur chaque route de la liste e2e (le titre du test ne le disait pas) |
| G7 tokens seuls | atteint | `grep -nE "#[0-9a-fA-F]{3,8}\b" dist/assets/styles.css \| wc -l` ; `bun test src/styles.test.ts` | 0 valeur hexadécimale |
| G8 diagrammes | atteint | `bun run detect "$(mktemp -d)" dist docs/diagrams` ; `self_check.py` | `self_check` OK ×3 ; détecteur 0 trouvaille ; DIAG-1 : 13/13, 13/13, 12/12 ; DIAG-5 : 6 fichiers, 0 nom d'état |
| G9 contenu gardé | atteint | `bun run build` | 27 textes examinés, 0 violation ; liste en donnée (`forbidden-claims.json`) |
| G10 vérification visuelle | atteint | `bun scripts/capture.ts <dossier>` | 28 captures (14 gabarits × 2 largeurs), observées une à une (§3) |
| G11 `bun run check` | atteint | `bun run check` | exit 0 ; 314 tests, 0 échec |

## 2. Objectifs O1 à O11

| Objectif | Statut | Preuve |
|---|---|---|
| O1 CI de la PR verte | atteint | `gh pr checks 13` : `composition / validate` pass sur la tête poussée |
| O2 accueil lu de la projection | atteint | `O2 champs de marque rendus: 7` |
| O3 couche, type, dépendances | atteint | 15 / 15 pages ; liste en 5 groupes (4, 3, 2, 3, 3) |
| O4 pages V2 | atteint | 5 routes (`/offres`, `/licences`, `/deployer`, `/fabrique`, `/signaler`) ; 28 pages |
| O5 mouvement borné | atteint | `src/motion.test.ts` ; e2e `motion.e2e.ts` : 0 animation sous `reduce` |
| O6 présentations relues | non atteint, propriétaire | 0 / 15 relues |
| O7 FR-04 en e2e | non atteint | 2 `test.fixme` (FR-04 ressources, FR-10 fiche retirée) |
| O8 détecteur rejouable | atteint | `bun run detect` : clone, build verrouillé, 0 trouvaille |
| O9 DIAG-1 automatisé | atteint | `src/diagram-nodes.test.ts` |
| O10 divergences de doctrine | non atteint, propriétaire | 3 ouvertes (brand/README.md, docs/apps/website.md, `application_url`) |
| O11 recette signée | en attente, propriétaire | ce rapport |

Exigences non fonctionnelles : déterminisme `NFR déterminisme: deux assemblages, 48 fichiers, 0
différence` ; poids `NFR poids: 28 pages, la plus lourde licences/index.html (123918 octets sur
153600)`.

## 3. Captures observées

Une ligne par capture. « Aucun débordement » signifie qu'aucun contenu ne dépasse la largeur de
la fenêtre sur la capture.

| Gabarit | 1440 px | 390 px |
|---|---|---|
| `/` | promesse en `h1`, 7 champs de marque, phrase de comptage ; aucun débordement | idem ; en-tête sur une ligne, pied de page sur deux |
| `/mission` | un titre et une phrase ; page courte | idem |
| `/methode` | introduction et 3 affirmations, chacune avec limite, date et source | idem ; aucun débordement |
| `/produits` | 5 groupes de couches, 15 cadres ; 10 résumés en anglais « recovered sources… » | idem ; le nom du produit est répété au début du résumé de 10 cadres |
| `/fabrique` | tableau 4 colonnes × 15 lignes ; adresses de dépôt sur deux lignes | 15 blocs de 4 lignes, page de 3633 px |
| `/offres` | 5 cadres, « Voir la preuve » dans chacun | idem ; le lien passe à la ligne dans 3 cadres |
| `/preuves` | tableau 5 lignes ; relevé avant correctif : la ligne ADR 0003 affichait 0 examinée et 15 en colonne « Violations » (corrigé, voir §4) | lignes étiquetées, aucun en-tête coupé |
| `/gouvernance` | une phrase et un lien | idem |
| `/corrections` | « Aucune correction publiée à ce jour. » ; le pied de page contient un lien vers la page elle-même (exigé par FR-05) | idem |
| `/contribuer` | une phrase et l'adresse de la forge | idem ; l'adresse passe à la ligne |
| `/deployer` | cible et deux SHA complets sur une ligne chacun | SHA complets sur 3 lignes, aucun débordement |
| `/licences` | tableau 15 lignes, identifiants sur une ligne chacun | 15 blocs ; aucun identifiant coupé au tiret |
| `/signaler` | 3 sections, 1 lien vers les issues du site | idem |
| `/produits/execution-sandbox` | couche et type sur une ligne, 3 dépendances, 5 limites, citation avec `http://localhost:8080/...` | idem |

## 4. Écarts et constats non corrigés

1. **Corrigé** après relevé : `/preuves` comptait 15 présentations non relues en « Violations ».
   La ligne lit désormais « présentations relues : 0 sur 15 », 15 examinées, 0 violation.
2. **Corrigé** après relevé : chaque pied de page contenait un lien vers la page elle-même. Il est
   retiré, sauf le journal des corrections sur `/corrections`, que FR-05 exige sur toutes les
   pages. Même correctif : « Offres » et « Preuves » n'étaient pas séparés par une espace dans le
   texte de l'en-tête.
3. Citations : `SITE_ORIGIN` vaut `http://localhost:8080` ; les citations publiées contiennent
   cette adresse. Dépend de l'ADR d'hébergement (S8.2).
4. Textes de fiche : 10 résumés sur 15 sont le placeholder anglais ; « Situation actuelle »
   de `execution-sandbox` cite la maturité, l'exposition et des phases `pending`. Corrigé
   seulement par la relecture des présentations (O6).
5. **Retiré** : une première version de ce rapport affirmait que le défilement horizontal n'était
   testé que sur 3 pages. Le test parcourt toute la liste de routes ; seul son titre était
   trompeur.
6. e2e : 17 ignorés = 9 axe sans JavaScript + 2 `test.fixme` × 4 projets.
7. G5 : la preuve de discrimination de FR-02, FR-07 et FR-08 date d'une session antérieure et n'a
   pas été rejouée ici ; elle l'a été pour FR-15 (signaler), FR-16 (mouvement), O2, O3, DIAG-1,
   DIAG-5, les gates de poids et de déterminisme.
8. Sources de texte des diagrammes (`*.nodes.txt`) : dérivées du rendu, non relues contre le PRD.
9. `/offres` : le libellé « Voir la preuve » est identique dans les 5 cadres.
10. Une dépendance de composition reste requise : `node_modules` pointe vers une composition
    locale (`file:../project-governance` dans `package.json`).

## 5. Non fait

Relecture des 15 présentations, amendements de gouvernance, ADR d'hébergement, staging, anglais,
trame d'atelier (S4.3, D-open-3).
