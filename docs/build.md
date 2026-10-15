# Construire le site

## Prérequis

- Bun, version exacte de `toolchains/bun.json` du dépôt de gouvernance (`1.4.0-canary.1+57f349f63`).
- Les dépendances `file:` installées selon la procédure de composition de `project-governance`
  (`docs/LOCAL-COMPOSITION.md`). `node_modules/@libre-ai/ui` et `node_modules/@libre-ai/governance`
  doivent exister.

## Source des fiches

Les fiches `project.v1.yaml` sont une **copie versionnée** sous `src/data/cards/`, prise dans
chaque dépôt au commit épinglé dans `src/data/card-sources.json`, qui enregistre aussi le SHA-256
de chaque fichier. Le build vérifie la copie contre ces empreintes avant toute autre chose et
refuse une copie modifiée à la main, manquante ou non épinglée (`site.snapshot_refused:…`).
L'autorité reste le dépôt de chaque produit ; la copie est contrôlée, pas saisie.

Mettre à jour la copie et ses empreintes (réseau, `gh` authentifié) :

```sh
bun src/fetch-cards-cli.ts          # écrit src/data/cards et met à jour card-sources.json
git diff src/data                   # relire avant de committer
```

Pour changer de commit, éditer `sha` dans `card-sources.json` puis relancer la commande.
`LIBRE_AI_CARDS_DIR=<dossier>` remplace la copie par un autre dossier pour un essai local ; la
copie versionnée est tout de même vérifiée.

## Commandes

```sh
bun run build                       # construit dist/, sans réseau ni variable
bun run check                       # toolchain, build, secrets, données personnelles, licences, lint, typecheck, tests
bunx playwright test                # e2e sur dist/, serveur local http://localhost:8080 (navigateurs : bunx playwright install firefox webkit)
bun run build:brand                 # ancien générateur, fondé sur le portefeuille seul
```

## Ce que le build imprime

Chaque contrôle imprime ses compteurs, y compris les contrôles réussis :

- `G2 instantané` : fiches vérifiées contre leurs empreintes, et la source lue.
- `G2 univers` : dépôts du portefeuille, dont couverts par une fiche.
- `G2 fiches lues` : fiches lues et pages produit générées.
- `G1 pages fixes` : routes fixes et fichiers écrits.
- `G3 ressources examinées` : présentations examinées (brouillons compris).
- `ADR 0003 présentations` : rédigées, relues et publiées.
- `G9 textes examinés` : textes passés au contrôle des mots interdits, et violations.

La page `/preuves` reprend les mêmes compteurs, avec la commande de reproduction.

## Détecteur de qualité visuelle (O8)

Rejouable depuis un clone neuf, sans binaire téléchargé : le détecteur est cloné à un commit
complet épinglé (`src/detect-plan.ts`), compilé avec `cargo build --locked`, puis lancé sur chaque
dossier donné. Prérequis : `git` et une toolchain Rust `stable`.

```sh
bun run build
bun run detect "$(mktemp -d)" dist docs/diagrams
```

Le dossier de travail doit être neuf et vide (refus sinon). Sortie : un compteur par dossier et
`detect total findings: 0`. Toute trouvaille, ou toute sortie qui n'est pas un tableau JSON,
fait sortir le script en code 1. La télémétrie du détecteur est désactivée.

## Sortie

`dist/` est écrit de façon atomique : une construction en échec ne remplace jamais un dist valide.
`dist/` n'est pas versionné.
