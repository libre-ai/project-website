# Format de fiche produit

Une fiche est un fichier `<repository>.project.v1.yaml`, copié sous `src/data/cards/` depuis le
dépôt produit au commit épinglé dans `src/data/card-sources.json` (voir `docs/build.md`). La
source de vérité est le `project.v1.yaml` du dépôt produit ; la copie est vérifiée par empreinte
et jamais éditée à la main.

## Champs lus par le site

| Champ | Type | Sert à |
| --- | --- | --- |
| `project` | texte | nom de la route `/produits/<project>` |
| `repository` | texte | `libre-ai/<project>`, lien vers la forge |
| `exposure` | `idea`, `spec-published`, `usable-verifiable`, `proven` | lu et validé, **non affiché** (ADR 0003) |
| `maturity` | `idea`, `specified`, `usable`, `proven` | maturité affichée |
| `summary` | texte non vide | résumé de la fiche |
| `current_situation` | texte, au moins 10 caractères | situation actuelle, état présent uniquement |
| `non_goals` | liste de textes | section « Limites » (FR-03) : non vide |
| `freshness.last_verified_on` | date réelle `AAAA-MM-JJ` | date de vérification, citation et flux (FR-12) |
| `application_url` | URL, optionnel | lien « Ouvrir le produit », affiché dès qu'il existe (ADR 0003) |

Le champ `application_url` n'existe pas encore dans le schéma `project.v1` de `project-governance` :
la proposition est dans le scratchpad du travail, à faire valider côté governance.

## Règles de refus

- Une fiche sans l'un de ces champs, ou avec une valeur hors échelle, fait échouer la construction.
- Une fiche `idea` ou `spec-published` avec `application_url` fait échouer la construction.
- Une fiche sans section `non_goals` non vide fait échouer la construction.
- Un produit du portefeuille sans fiche fait échouer la construction, sauf s'il figure dans
  `src/data/card-exclusions.json` avec une raison.

## Exemple

```yaml
schema_version: "1.0"
project: execution-sandbox
repository: libre-ai/execution-sandbox
exposure: spec-published
maturity: specified
summary: "Bibliothèque de confinement en cours de spécification."
current_situation: "La spécification est publiée ; aucun binaire n'est livré à ce stade."
non_goals:
  - "Pas de garantie de confinement sur systèmes non qualifiés."
freshness:
  last_verified_on: "2026-09-12"
```

Une fiche `usable-verifiable` ou `proven` peut porter `application_url`. Sans cette URL, la page
affiche seulement le lien « Code source » vers son dépôt, jamais un lien vide.
