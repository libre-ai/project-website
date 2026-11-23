# ADR 0009 — Le site et sa liste d'attente sont servis par un binaire Rust

- **Statut** : accepté par le propriétaire le 2026-11-23 (question structurée en chat : « La
  liste d'attente de libre-ia.fr (ADR 0006) contredit l'ADR-0063 D3. Que fait-on ? » ; choix
  cité verbatim : « Porter en Rust avant lancement »).
- **Portée** : runtime du site public `libre-ia.fr` et de sa liste d'attente ; le déploiement
  reste un jalon ultérieur, comme dans l'ADR 0006.
- **Amende** : ADR 0006, décision 1 (« Un processus `Bun.serve` ») et décision 3 (« accès par
  `Bun.sql` ») ; `docs/apps/website.md` (§Runtime, §Runtime boundaries : « No Rust runtime is
  justified in v1 »). Tout le reste de l'ADR 0006 est inchangé.

## Contexte

L'ADR 0006 fait servir le site et la liste d'attente par un processus Bun. L'ADR-0063 de
`libre-ai/project-governance` (proposé) décide en D3 qu'« Aucun processus Bun ne sert une
requête d'utilisateur ni ne traite son contenu » ; une adresse électronique et la preuve de son
consentement sont du contenu. Sa mesure relève la contradiction avec l'ADR 0006 et consigne la
décision du propriétaire du 2026-11-23 citée au statut. Rien n'était déployé : aucun
utilisateur n'est servi par Bun aujourd'hui (`tools/clever` ne déploie qu'une cible statique
Caddy).

## Décision

1. **Le runtime est un binaire Rust**, `site-server` (`crates/site-server`) : axum pour HTTP,
   sqlx pour PostgreSQL, lettre pour le relais SMTP. Il sert les fichiers générés avec la même
   politique d'en-têtes et les trois mêmes routes dynamiques ; la purge horaire des demandes
   expirées tourne dans le même processus et en ligne de commande (`site-server purge`). Sa
   configuration vient de l'environnement ; une erreur nomme la variable, jamais sa valeur.
2. **Tout le reste de l'ADR 0006 est inchangé** : routes, une seule politique d'en-têtes (le
   binaire lit `crates/site-server/policy.json`, rendu depuis `src/headers.ts`,
   `src/content/consent.ts` et `src/content/universes.ts`, et un test vérifie que le fichier
   suivi égale ce rendu), schéma de `subscribers`, cycle (double confirmation, expiration à
   48 h, suppression à la désinscription), anti-abus, journaux sans adresse ni jeton ni IP,
   boîte d'envoi locale pour la démonstration, base de production et base de test.
3. **Le remplacement est conditionné par un test de parité** (ADR-0063 D5, « Test de parité de
   D5 ») : `server/parity.test.ts`. Les mêmes requêtes vont à l'implémentation Bun (la
   référence), lancée deux fois, et au binaire Rust, chacun sur une base neuve. Sont comparés
   après chaque étape : statut, en-têtes, corps, état de `subscribers` ; puis les messages
   écrits et les lignes de journal. Le corpus nomme ses sources (`server/parity/corpus.ts`) ;
   ce qui varie entre deux exécutions de la référence est couvert par des normaliseurs nommés
   (`server/parity/normalize.ts`), sans joker ; une empreinte des fichiers de la référence
   (`server/parity/reference-fingerprint.json`) fait rougir le test si la référence change ; le
   test imprime le volume comparé et échoue sur une source absente.
4. **Bun ne sert plus aucune requête.** `server/http.ts` et les modules qu'il emploie restent
   comme **référence de parité**, non déployable : rien ne la lance hors du test de parité. La
   démonstration locale (`bun run demo`) et la suite e2e passent par le binaire Rust ;
   `server/demo.ts` lance PGlite et le binaire, et ne sert aucun utilisateur.
5. **Double exécution temporaire** (ADR-0063 D5 (g)) : propriétaire, le propriétaire du dépôt ;
   **date de suppression de la référence Bun : 2027-03-31**, ou plus tôt, au premier
   déploiement du binaire vérifié par les smokes. Sa suppression retire `server/http.ts` et ses
   modules, le test de parité, son corpus et son empreinte, dans une même pull request.

## Divergences enregistrées

Mesurées pendant le portage, sur Bun 1.4.0-canary.1+57f349f63 ; le port reproduit chaque
comportement de la référence, et un test Rust garde la table mesurée.

- `domainToASCII` de `node:url` sous Bun rend tel quel un domaine tout ASCII (un label `xn--`
  invalide passe) sauf s'il contient un code point interdit d'hôte (`%` et `*` passent) ; un
  domaine non ASCII passe par UTS 46 (`email.rs`, `converts_domains_as_the_reference_measured`).
- Bun ne construit `request.url` depuis l'en-tête Host que si chaque octet en est un octet
  d'hôte RFC 3986 ; sinon `new URL(request.url)` lève et la référence répond 500 (`http.rs`,
  `builds_the_request_url_as_the_reference_measured`).
- `Bun.serve` garde la connexion ouverte après la réponse à un POST malgré `Connection: close` :
  le client du test délimite lui-même la réponse.

## Non comparé

Temps de réponse, mémoire, concurrence ; le transport SMTP (les deux côtés écrivent dans une
boîte d'envoi ; le client SMTP Rust a ses tests contre un relais local) ; les pannes de base
(test Rust) ; un corps de plus de 64 Kio et une requête HTTP/1.1 sans Host (chaque pile les
refuse à sa façon) ; un hôte qui contient `%` et un label `xn--` ; les lignes de démarrage et
d'arrêt du binaire, sans équivalent dans la référence.

## Conséquences

- Le dépôt porte un espace de travail Cargo (`Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`)
  et le `deny.toml` commun de la flotte ; `bun run check` exécute `check:dependency-policy`
  (cargo-deny : bans, licences, sources) et `check:rust` (fmt, clippy `-D warnings`, tests).
- Le limiteur reste indexé sur l'adresse de la connexion, comme la référence. Derrière un
  proxy, toutes les requêtes partageraient une clé : le jalon de déploiement doit décider de
  l'en-tête d'origine à croire avant la mise en ligne.
- Les requêtes sqlx sont non préparées (`persistent(false)`), pour PGlite et les poolers.
- `tools/clever` est inchangé : il ne déploie qu'une cible statique ; le déploiement du binaire
  relève du jalon de déploiement.
