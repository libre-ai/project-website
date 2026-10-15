# ADR 0003 — Les produits sont présentés comme existants ; l'état réel vit dans le dépôt

- **Statut** : accepté par le propriétaire le 2026-10-14, en réponse à une question structurée
  (option « Produits présentés comme existants »), contre la recommandation de l'agent.
- **Portée** : site public, branche `work/website-refonte-v1`. Remplace FR-02 et amende le PRD §1, §9.

## Contexte

Les 15 fiches `project.v1` lues le 2026-10-14 donnent 10 dépôts en `idea`, 3 en `spec-published`
et 2 autorités en `usable-verifiable`. Le PRD v0.2 (§1 : « rendre visible l'état réel de chaque
produit »), `docs/apps/website.md` (non-but : « claiming availability from repository existence »)
et la plateforme de marque de `project-governance` (« toute capacité publique reste bornée par une
preuve datée ») exigeaient d'afficher cet état sur chaque page produit, et le gate FR-02 refusait
une URL applicative sur une fiche `idea` ou `spec-published`.

Le propriétaire décide que le site porte la promesse, et que la transparence d'état est assurée par
les dépôts publics (fiches `project.v1.yaml`, gates de flotte, journal), non par le site.

## Décision

1. Les pages produit décrivent chaque produit au présent : nom, résumé, ce qu'il fait, ses limites,
   son code source. Aucune étiquette `exposure` ou `maturity` n'est affichée.
2. Le gate FR-02 (URL applicative interdite pour `idea` / `spec-published`) est retiré. Une URL
   applicative est affichée dès qu'une fiche en porte une.
3. La citation (FR-12) garde l'auteur, la date de vérification et la source ; elle ne mentionne
   plus l'exposition.
4. Chaque page produit garde un lien « Code source » vers son dépôt : c'est là que l'état réel se lit.
5. La page `/preuves`, le journal des corrections et les limites (FR-03) sont conservés.

## Ce que cette décision contredit, et qui reste à traiter par le propriétaire

- `project-governance/brand/README.md` (« bornée par une preuve datée ») et `docs/apps/website.md`
  (non-but d'availability) ne sont pas modifiés : ils relèvent de l'autorité, en lecture seule
  pour ce travail. Le site diverge de son autorité tant qu'elle n'est pas amendée.
- Le PRD §1, FR-02 et §9 sont amendés dans le dossier de travail pour refléter cette décision.

## Conséquences

- Les tests FR-02 (unitaires, build, e2e) sont remplacés par des tests qui vérifient l'absence
  d'étiquette d'état sur les pages publiques et la présence du lien vers le code source.
- G2 (lecture des fiches depuis la source) est conservé : l'état est lu, il n'est plus affiché.
- Le gate G9 (mots interdits de la charte) est conservé.
