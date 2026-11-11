# ADR 0004 — Identité : martinet affiné, palette Aube, une volée d'oiseaux origami

- **Statut** : accepté par le propriétaire le 2026-11-09 (décisions 5, 7 et 14 de la recette du
  prototype v4, chat du 2026-11-09).
- **Portée** : site public `libre-ia.fr`.
- **Remplace** : ADR 0002 (direction visuelle hybride, aucun élément figuratif).

## Contexte

L'ADR 0002 excluait tout élément figuratif tant que le signe « Portique d'atelier » n'avait pas
sa licence. Le propriétaire a repris l'identité d'origine de `libre-ia.fr` : le martinet, dont il
est l'auteur (« le logo est ma création »), affiné pendant la recette du prototype v4. La recette a
aussi tranché la palette, le mode d'affichage par défaut et les logos d'applications.

## Décision

1. **Marque** : le martinet d'origine, mêmes tracés ; corps en dégradé Aube (émeraude vers ciel),
   aile à l'encre. Logotype « libre·ia » : les points des deux « i » deviennent les pixels du
   martinet. Nom affiché : « Libre IA ».
2. **Palette Aube**, mode clair d'abord : fond `#F4F8F6`, encre `#0A2A1E`, émeraude `#0BA360`,
   ciel `#3CB9E8`. Le mode sombre existe, il est secondaire. Les couleurs d'univers partagent une
   même luminance et une même chroma en OKLCH ; seules les teintes diffèrent.
3. **Contraste prouvé, pas affirmé** : chaque paire texte/fond déclarée par les jetons atteint
   4,5:1 (texte courant) ou 3:1 (grand texte, éléments d'interface), en clair comme en sombre. Un
   test calcule ces ratios ; une paire sous le seuil fait échouer le build.
4. **Polices auto-hébergées** : Bricolage Grotesque (titres) et Source Sans 3 (texte), toutes
   deux sous OFL-1.1, servies depuis le site avec leur licence. Aucune police distante.
5. **Logos d'applications** : un oiseau origami à facettes par application, une espèce par
   application, posé sur l'objet origami de sa fonction (« l'objet porte l'oiseau » : document,
   calendrier, écran, bouclier…). Les 40 objets sont dessinés dans le jalon du socle (décision du
   2026-11-11).
6. **Un seul exemplaire par page** : les oiseaux et le martinet vivent dans un sprite SVG
   externe (`<symbol>` référencés par `<use>`), mis en cache une fois, jamais recopiés dans le
   HTML.

## Conditions avant publication sur un domaine public

- Recherche d'antériorité du martinet et des noms « Libre X » (INPI, EUIPO). Le droit d'auteur du
  propriétaire sur le dessin ne vaut pas disponibilité de marque.
- Licence du martinet, des oiseaux et des objets dans ce dépôt public : **tous droits réservés**
  (décision du propriétaire du 2026-11-11), sous `LicenseRef-Libre-AI-Brand-1.0`, l'identifiant
  prescrit par `TRADEMARKS.md` de `project-governance`, déclaré dans `REUSE.toml` pour
  `src/brand/**`. Le reste du code reste sous EUPL-1.2, les textes sous CC-BY-4.0.
- `TRADEMARKS.md` exige deux contrôles indépendants avant toute publication d'un élément
  figuratif : le texte exact de la licence accepté par le propriétaire, et une revue de
  similarité visuelle datée et archivée (EUIPO, INPI, WIPO, références nommées). D'ici là, les
  dessins sont un candidat non publié, et toute publication (site, paquet, profil) échoue fermée.

## Conséquences

- Les exclusions de l'ADR 0002 (aucun figuratif, aucun logo legacy) sont levées pour ce site.
  `docs/brand-references.md` reste la liste des références legacy et de leurs conditions.
- La plateforme de marque de `project-governance` (palette « Envol constructif ») n'est plus la
  source des couleurs du site : les jetons Aube sont définis dans ce dépôt. Le site diverge de
  cette autorité tant qu'elle n'est pas amendée.
