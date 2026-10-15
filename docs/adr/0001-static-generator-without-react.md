# ADR 0001 — Générateur statique sans React

- **Statut** : accepté par le propriétaire le 2026-10-14 (recommandation validée, « go »).
- **Portée** : refonte V1 du site public, branche `work/website-refonte-v1`.

## Contexte

`docs/apps/website.md` et le PRD (décision D-C) prescrivaient « Bun fullstack + React 19 SSR ».
Le dépôt n'a aucune dépendance React : la génération écrit du HTML par fonctions TypeScript.
Le PRD affirmait que le dépôt confirmait React ; cette affirmation était fausse.

## Décision

Conserver le générateur statique existant (fonctions TypeScript qui renvoient des chaînes HTML,
échappées par `escapeHtml`). Ne pas ajouter React.

## Raisons

- Les pages de contenu n'ont aucun JavaScript client (FR-07, CSP `script-src 'none'`).
  React ne sert alors qu'à produire du HTML statique, comme le fait déjà le générateur.
- Sortie déterministe, déjà testée. Aucune dépendance de rendu à auditer.
- Le filtre par `exposure` peut être statique (liens générés), sans JavaScript.

## Conséquences

- `docs/apps/website.md` (« React 19 SSR ») et le PRD D-C sont à corriger. Non modifiés dans ce tour.
- Si une fonctionnalité interactive devient nécessaire, cette décision doit être rouverte par un
  nouvel ADR : elle contredit la règle « aucun JavaScript client sur les pages de contenu ».
