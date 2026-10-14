# Construire le site

## Prérequis

- Bun, version exacte de `toolchains/bun.json` du dépôt de gouvernance (`1.4.0-canary.1+57f349f63`).
- Les dépendances `file:` installées selon la procédure de composition de `project-governance`
  (`docs/LOCAL-COMPOSITION.md`). `node_modules/@libre-ai/ui` et `node_modules/@libre-ai/governance`
  doivent exister.
- Un dossier de fiches `project.v1.yaml` (voir `docs/content-format.md`).

## Commandes

```sh
# Construire dist/ à partir d'un dossier de fiches. Échoue fermé sans la variable.
LIBRE_AI_CARDS_DIR=<dossier des fiches> bun run build

# Suite complète : toolchain, build, secrets, données personnelles, licences, lint, typecheck, tests.
LIBRE_AI_CARDS_DIR=<dossier des fiches> bun run check

# Tests de bout en bout sur dist/ (serveur local sur http://localhost:8080).
# Nécessite dist/ construit et les navigateurs Playwright installés.
bunx playwright test --project=chromium --project=chromium-no-js
```

L'ancien générateur, fondé sur le portefeuille seul, reste disponible :

```sh
bun run build:brand
```

## Ce que le build imprime

Chaque contrôle imprime ses compteurs, y compris les contrôles réussis :

- `G2 univers` : dépôts du portefeuille, dont couverts par une fiche.
- `G2 fiches lues` : fiches lues et pages produit générées.
- `G1 pages fixes` : routes fixes et fichiers écrits.
- `G3 ressources examinées` : ressources contrôlées (0 tant qu'il n'y a pas de corpus de ressources).
- `G9 textes examinés` : textes passés au contrôle des mots interdits, et violations.

La page `/preuves` reprend les mêmes compteurs, avec la commande de reproduction.

## Sortie

`dist/` est écrit de façon atomique : une construction en échec ne remplace jamais un dist valide.
`dist/` n'est pas versionné.
