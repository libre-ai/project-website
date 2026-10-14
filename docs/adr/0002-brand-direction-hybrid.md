# ADR 0002 — Direction visuelle : doctrine actuelle, références legacy différées

- **Statut** : accepté par le propriétaire le 2026-10-14 (option 3 : hybride).
- **Portée** : site public V1, branche `work/website-refonte-v1`.
- **Relève de** : ADR 0001 (générateur sans React), plateforme de marque de `project-governance`.

## Contexte

Deux systèmes visuels coexistent dans les sources :

1. **Doctrine actuelle** (plateforme de marque, `brand/README.md` de `project-governance`) :
   palette « Envol constructif » réalisée par `@libre-ai/ui`, grammaire du cadre ouvert, joint
   orthogonal, ligne d'assemblage, étiquette de preuve, trame d'atelier discrète. Exclus : halos,
   cerveaux, étincelles, orbites, chatbots, réseaux décoratifs, contours topographiques, dégradés
   jade/iris. Aucun élément figuratif publié tant que le signe « Portique d'atelier » n'a pas sa
   licence dédiée et son contrôle de similarité.
2. **Identité legacy** (`~/Documents/assets/references/legacy/design-system-c8fb246`) : oiseau vert,
   domaine `libre-ia.fr`, illustrations, mascotte, hero en globe 3D, animations de logo (Lottie/SVG).
   Classée legacy ; l'historique des anciennes marques est déclaré détruit.

## Décision

- **Maintenant** : la structure du site suit la doctrine actuelle. Aucun élément figuratif, aucune
  illustration, aucune mascotte, aucun logo legacy.
- **Animations** : seulement des transitions CSS, sans JavaScript (FR-07), désactivées sous
  `prefers-reduced-motion`. Pas d'animation de logo.
- **Vague ultérieure** : les illustrations et animations legacy restent des références. Elles ne
  entrent dans le site qu'après publication du signe (licence, similarité) et décision écrite
  sur l'identité visuelle.

## Conséquences

- Le site paraît sobre. C'est voulu : la doctrine interdit les décors, et la preuve passe avant
  l'effet.
- Les textes d'appel de l'accueil reprennent ceux de la plateforme : « Prenez les clés. » et
  « Voir les preuves. ».
- Les références legacy et leurs conditions d'usage sont listées dans `docs/brand-references.md`.
