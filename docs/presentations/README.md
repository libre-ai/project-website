# Présentations des produits (ADR 0003)

Une présentation par produit, `<repository>.presentation.yaml`. C'est le texte éditorial que la
page produit affiche à la place du résumé et de la situation actuelle de la fiche. Les textes des
fiches `project.v1` restent dans les dépôts : ici, c'est la promesse.

## Champs

| Champ | Règle |
| --- | --- |
| `project` | nom du dépôt, doit avoir une fiche (sinon la construction échoue) |
| `title` | titre affiché |
| `author` | auteur humain ; un brouillon porte `À renseigner par le relecteur` |
| `ai_assistance` | assistance IA déclarée (FR-04) |
| `nature` | `fait`, `analyse`, `opinion` ou `guide` (charte §9) |
| `review_date` | date réelle `AAAA-MM-JJ` de la dernière relecture (FR-04) |
| `reviewed` | `true` seulement après relecture humaine ; **`true` avec l'auteur placeholder fait échouer la construction** |
| `pitch` | une phrase au présent |
| `capabilities` | ce que le produit permet, liste non vide |
| `audience` | pour qui |

## Cycle

1. Brouillon rédigé (ici : par un modèle de langage, à partir des champs `scope` et `statement`
   de la fiche, traduits), `reviewed: false`. La page retombe sur la fiche ; le compteur
   « présentations : N rédigées, M relues » l'imprime.
2. Relecture par une personne : corriger le texte, mettre son nom dans `author`, la date dans
   `review_date`, `reviewed: true`.
3. La page affiche la présentation. Le gate G9 (mots interdits) s'applique à tout le texte.

État au 2026-10-14 : 15 brouillons, 0 relu.
