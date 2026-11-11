# ADR 0007 — Contenu : la promesse d'abord, rien présenté comme disponible

- **Statut** : accepté par le propriétaire le 2026-11-09 (décisions 2, 4, 6, 8 à 11 et 13 de la
  recette du prototype v4 ; brief du socle validé le même jour).
- **Portée** : site public `libre-ia.fr`.
- **Remplace** : ADR 0003 (produits présentés comme existants).

## Contexte

L'ADR 0003 décrivait chaque produit au présent. La recette du prototype v4 a réorienté le site :
il porte une ambition, « la fabrique en commun », et ne décrit pas un catalogue. Le brief validé
le 2026-11-09 pose l'invariant « aucun produit présenté comme disponible ».

## Décision

1. **Promesse** : « Ce que chacun réinvente seul, faisons-le ensemble. » ; « Vos outils. Vos
   données. Votre IA. » ; « Décrivez un besoin, la fabrique le construit, tout le monde en
   profite. »
2. **Aucun produit présenté comme disponible** : aucun bouton « essayer », « télécharger » ou
   « ouvrir » ; l'action proposée sur une application est la liste d'attente.
3. **Aucun compteur ni état** sur le site : ni nombre de dépôts, ni maturité, ni avancement. Le
   statut se lit sur la forge (lien vers le code source).
4. **Illustrations** : les visuels montrent le résultat visé, stylisé, marqué « Illustration » ;
   jamais une capture d'écran ni un faux écran (I-15).
5. **Applications** : 40 (P01 à P40), noms « Libre X ». Six noms tranchés : Sources (P01),
   Corpus (P03), Canevas (P14), Tempo (P28), Antenne (P29), Cours (P39) ; les autres sont
   provisoires. Présentation : libellé de fonction, micro-démo animée, trois étiquettes.
6. **Univers par verbe** (8) : S'informer · Écrire et calculer · Travailler ensemble · Créer et
   publier · Apprendre · Se divertir · Se protéger · Piloter l'IA. L'accueil les présente en
   onglets.
7. **Parcours « Je veux… »** en accordéon avec scène ; **« Comment c'est fait »** en visite guidée
   (suivre une demande, 7 étapes) et explorateur de couches.
8. **Premier écran** : « Chacun seul / Ensemble ».
9. **Réseaux** (GitHub, Discord, LinkedIn) affichés seulement quand l'adresse existe ; aucun
   emplacement provisoire, pas de Matrix.
10. **Pages de transparence conservées** : preuves, corrections, licences, déployer, signaler,
    et une page par brique de la forge. Les pages mission, méthode, gouvernance et contribuer
    sont fusionnées dans « À propos » ; offres et comparaisons sont retirées (elles décrivaient
    des capacités au présent).

## Conséquences

- Le gate de l'ADR 0003 (aucune étiquette d'état) est conservé ; il s'y ajoute un contrôle des
  formulations de disponibilité et des compteurs sur les pages générées.
- Les noms provisoires, la répartition des 40 applications dans les 8 univers et les 40 icônes
  « l'objet porte l'oiseau » restent à trancher par le propriétaire ; ils vivent dans des fichiers
  de données, et les changer ne touche pas au code.
