# ADR 0005 — JavaScript léger auto-hébergé, en amélioration progressive

- **Statut** : accepté par le propriétaire le 2026-11-09 (décision 12 de la recette du prototype
  v4 ; effets retenus en fin de session, même jour).
- **Portée** : site public `libre-ia.fr`.
- **Amende** : ADR 0001 (« aucun JavaScript client sur les pages de contenu ») ; la règle
  « No ... client JavaScript » de `AGENTS.md`.

## Contexte

L'ADR 0001 gardait le générateur statique et interdisait tout script client (CSP
`script-src 'none'`). La recette du prototype a demandé des effets que le CSS seul ne rend pas :
transition de vue entre les silos et les cartes, onglets à indicateur glissant, bascule de thème
mémorisée, visite guidée pas à pas. Le propriétaire admet un TypeScript léger, auto-hébergé, à
condition que le site reste complet sans lui.

## Décision

1. **Le site est complet sans script.** Chaque contenu, lien et formulaire fonctionne avec le
   JavaScript désactivé ; un projet e2e sans JavaScript le vérifie sur chaque route.
2. **Un seul module**, écrit en TypeScript dans ce dépôt, empaqueté au build par `Bun.build`,
   servi depuis le site (`script-src 'self'`). Aucune bibliothèque tierce dans le paquet client.
3. **Aucune requête réseau depuis le script** : `connect-src 'none'` est conservé.
4. **Stockage** : `localStorage` pour le seul choix de thème, chaque accès dans un `try/catch` ;
   son absence laisse le thème du système.
5. **Effets retenus** (les quatre) :
   - silos qui se transforment en cartes Libre (API View Transitions) dans « Seul / Ensemble » ;
     sans script ou sans l'API, la bascule reste une case à cocher stylée par `:has()` ;
   - origami qui se plie, en SVG et CSS seuls ;
   - défilement scénarisé natif (`animation-timeline`), sous `@supports`, dégradé propre hors
     Chrome et Edge ;
   - micro-interactions : bascule de thème iconique soleil → lune, onglets à indicateur glissant
     (motif ARIA « tabs »), accordéons fluides (`<details>` natifs), cartes inclinées au survol.
6. **Mouvement** : toute animation s'arrête sous `prefers-reduced-motion: reduce`, script compris.
7. **Budget** : le paquet client a un plafond en octets, imprimé et vérifié à chaque build.
8. **Particules** : supprimées (« globalement ratées »), aucune animation de fond sur `<canvas>`.

## Conséquences

- La CSP devient `script-src 'self'` ; `style-src 'self'` est conservé, d'où l'interdiction de
  tout attribut `style` et de tout `<style>` dans le HTML généré (contrôle au build).
- Les tests unitaires couvrent la logique pure du script (navigation clavier des onglets,
  résolution du thème) ; le comportement dans le DOM est couvert par l'e2e sur trois moteurs.
