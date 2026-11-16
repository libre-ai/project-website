# ADR 0008 — Une mesure datée sur « Comment c'est fait », avec ses limites

- **Statut** : **proposé**, non accepté. L'acceptation revient au propriétaire ; elle n'est pas
  acquise par la présence de ce fichier.
- **Portée** : page `/fabrique/` du site public.
- **Amende** : ADR 0007 §3 (aucun compteur ni état), sur un point précisé ci-dessous.

## Contexte

La page `/fabrique/` décrit les couches de la fabrique et affirme, dans sa couche « Preuve », que
tout se rejoue. Elle ne montrait aucune mesure. Le dépôt de gouvernance versionne un banc de
défauts semés : des défauts connus sont introduits dans une brique, chaque couche de vérification
est lancée séparément, et l'enregistrement dit ce que chacune a attrapé et ce qu'elle a signalé à
tort sur des cas sains. Sa projection destinée à un site est `distribution/index/trust-bench.v1.json`
(contrat `ecosystem/schemas/trust-bench.v1.schema.json`), dont le contrat exige qu'un consommateur
qui montre les chiffres montre aussi les limites.

L'ADR 0007 §3 interdit tout compteur et tout état sur le site : ni nombre de dépôts, ni maturité,
ni avancement.

## Décision proposée

1. La page `/fabrique/` montre la mesure, par couche : défauts attrapés sur défauts soumis, apport
   au-delà des couches moins chères, fausses alertes sur cas sains, réponses illisibles ; avec le
   dépôt et la révision mesurés, la date, et un lien vers le rapport et la donnée. Le titre et la
   description de la page nomment ce qui est mesuré : une brique, pas la fabrique.
2. Chaque nombre vient d'une copie versionnée de la donnée, épinglée comme les fiches (dépôt,
   commit, SHA-256 ; chemin fixé dans `src/trust-bench.ts`). Aucun nombre n'est saisi dans le site.
   La construction ne va pas sur le réseau et refuse une copie absente, vide, modifiée ou d'une
   autre forme.
   Ce qui se compte ou se nomme dans la donnée se rend depuis la donnée : le nombre de couches,
   propres et dérivées, les modèles consignés, et le second passage (ses conditions, son statut,
   ses lignes comparées, chaque état qui diffère de la référence). Le texte saisi autour du
   tableau n'affirme rien que la donnée ne porte.
3. Une couche dérivée, dont l'apport est déclaré non applicable par la donnée, est rendue « non
   applicable », jamais zéro. Une couche à qui aucun cas sain, ou aucun défaut, n'a été soumis est
   rendue « non mesuré », jamais « 0 sur 0 ».
4. Les limites déclarées par la mesure sont reprises telles quelles, toutes, sans tri ni résumé.
   La page ne généralise la mesure à aucun autre dépôt et ne promet aucun résultat.
5. **Portée de l'amendement à l'ADR 0007 §3** : les nombres d'une mesure datée, sourcée et
   accompagnée de ses limites ne sont pas des compteurs d'état. Le reste du §3 tient : aucun nombre
   de dépôts, d'applications ou de briques, aucune maturité, aucun avancement. Le contrôle des
   formulations (`checkCopy`) n'est pas modifié et s'applique à cette section.

## Ce que cette décision laisse ouvert

- La phrase « Tout se rejoue » de la couche « Preuve » (`src/content/factory.ts`, copie du
  prototype accepté le 2026-11-09) n'est pas modifiée. Elle cohabite avec une mesure qui dit ne pas
  être rejouée en pipeline : à trancher par le propriétaire.
- Le site est rendu en français seulement (`<html lang="fr">`) ; la section l'est aussi. Les limites
  citées sont dans la langue de la donnée.

## Conséquences

- Déplacer l'épingle est un changement relu : `sha` dans `src/data/trust-bench-source.json`, puis
  `bun src/fetch-trust-bench-cli.ts` (voir `docs/build.md`).
- Les captures de référence visuelles de `/fabrique/` changent.
