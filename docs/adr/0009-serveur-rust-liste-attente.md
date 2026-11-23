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
   écrits et les lignes de journal. Le corpus nomme ses sources (`server/parity/corpus.ts`), et
   chaque source est reliée à un contrôle : un scénario `reference-tests` cite les tests de
   `server/http.test.ts`, `store.test.ts` et `purge.test.ts` qu'il rejoue, et un test de ces
   fichiers ni rejoué ni excusé (`NOT_IN_CORPUS`, avec le test Rust qui tient l'affirmation) fait
   rougir ; un scénario `porting-risks` nomme la construction de la référence qu'il exerce, et
   une construction absente de la référence fait rougir ; `authored` désigne les cas écrits pour
   des bords qu'aucun test de la référence n'atteint. Ce qui varie entre deux exécutions de la
   référence est couvert par des normaliseurs nommés (`server/parity/normalize.ts`), sans
   joker ; les dates de `subscribers` y sont rapportées à l'étape du test dont la fenêtre
   d'horloge les contient, le vieillissement défait pour `requested_at` (un renouvellement qui
   garde la date de la première demande, ou une date loin de l'horloge du test, désigne une
   autre étape ou aucune), et `confirmed_at >= requested_at` est vérifié à chaque étape.
   L'empreinte de la référence (`server/parity/reference-fingerprint.json`) couvre ses fichiers
   **et l'exécutable Bun, version et révision exactes** : le test rougit si l'un ou l'autre
   change. Le test imprime le volume comparé et échoue sur une source absente.
4. **Bun ne sert plus aucune requête.** `server/http.ts` et les modules qu'il emploie restent
   comme **référence de parité**, non déployable : rien ne la lance hors du test de parité. La
   démonstration locale (`bun run demo`) et la suite e2e passent par le binaire Rust ;
   `server/demo.ts` lance PGlite et le binaire, et ne sert aucun utilisateur.
5. **Double exécution temporaire** (ADR-0063 D5 (g)) : propriétaire, le propriétaire du dépôt ;
   **date de suppression de la référence Bun : 2027-03-31**, ou plus tôt, au premier
   déploiement du binaire vérifié par les smokes. Sa suppression retire `server/http.ts` et ses
   modules, le test de parité, son corpus et son empreinte, dans une même pull request.

## Version de Bun de la référence

La référence s'exécute sous le Bun épinglé par la flotte : `toolchains/bun.json` de
`project-governance` donne la révision `1.4.0-canary.1+57f349f63`, et la CI l'emploie (journal
du run 45239055419 : « bun install v1.4.0-canary.1 (57f349f63) », mesuré le 2026-11-23). Les
réponses de la référence en dépendent : Bun 1.4.4 refuse des adresses et des hôtes que
1.4.0-canary.1 accepte (ci-dessous). D'où l'empreinte du runtime au point 3 : sous un autre Bun,
même de même version, le test de parité rougit avant toute comparaison, jusqu'à ce que la
référence soit rejouée et réenregistrée (`bun run parity:record`).

`engines.bun` reste `>=1.4.0` : le gate de flotte `check-bun-manifests.ts` de
`project-governance` exige exactement `">=" + minimumVersion`, et une valeur exacte le ferait
échouer. `packageManager` porte déjà `bun@1.4.0-canary.1`. L'épinglage exact vit donc dans
l'empreinte, pas dans `engines`.

## Divergences enregistrées

Mesurées pendant le portage, sur Bun 1.4.0-canary.1+57f349f63 (la référence épinglée) et sur
Bun 1.4.4-canary.1+963452075 ; un test Rust garde chaque table mesurée.

- `domainToASCII` de `node:url` : sous 1.4.0-canary.1, un domaine tout ASCII est rendu tel quel
  (un label `xn--` invalide passe, `%` aussi) ; sous 1.4.4, il passe par UTS 46 et un label
  `xn--` invalide ou un `%` sont refusés. **Le port suit 1.4.4** : il refuse `%` et les labels
  `xn--` invalides, et n'enregistre donc pas une adresse que la référence épinglée enregistre.
  Divergence **admise** : le corpus déclare, pour chacun de ces cas, l'issue de la référence
  (303 `merci`, une ligne, un message) et celle du port (303 `erreur`, rien), et le test de
  parité les vérifie toutes deux sous la seule révision mesurée (`email.rs`,
  `converts_domains_as_the_reference_measured` ; corpus : `refusedAddress`).
- Bun ne construit `request.url` depuis l'en-tête Host que si chaque octet en est un octet
  d'hôte RFC 3986 ; sinon `new URL(request.url)` lève et la référence répond 500 (`http.rs`,
  `builds_the_request_url_as_the_reference_measured`). Un hôte à label `xn--` invalide
  (`xn--a.fr`) : 1.4.0-canary.1 construit l'URL et répond 421 (hôte inconnu), 1.4.4 lève et
  répond 500. **Le port suit 1.4.4 (500)**, divergence admise et vérifiée de la même façon
  (scénario « hosts with an invalid punycode label »).
- Un octet non ASCII d'en-tête est lu par Bun comme un code point (Latin-1 : `C3 A9` donne
  `Ã©`), sous les deux versions ; le port fait de même au lieu de vider la valeur (scénario
  « header values with non-ASCII bytes »).
- `Bun.serve` garde la connexion ouverte après la réponse à un POST malgré `Connection: close` :
  le client du test délimite lui-même la réponse.

## Exploitation du binaire

Décisions de la revue du 2026-11-23, chacune tenue par un test :

- **Envoi hors du chemin de la requête.** Le transport SMTP est construit une fois au
  démarrage ; une réponse n'attend jamais l'envoi, ni sa préparation : le message part dans
  une file bornée (1024) qu'une tâche dépile, l'envoi tournant hors des fils du serveur. File
  pleine : la demande reste enregistrée, le message n'est pas envoyé, `mail.dropped` est
  journalisé ; une nouvelle demande renvoie le message (ADR 0006 §4). Au plus 4 envois sont en
  cours à la fois (`MAX_SENDS_UNDER_WAY`), les suivants attendent dans la file. Le transport
  est construit sans la fonctionnalité `pool` de lettre : chaque envoi ouvre sa propre
  connexion au relais et la ferme (`async_transport.rs` de lettre, `conn.abort()` hors
  `pool`) ; la borne de 4 limite donc aussi les connexions ouvertes vers le relais. Choix
  retenu contre le `pool` : une connexion par message, sans état partagé entre deux envois,
  au débit d'une liste d'attente.
- **Délais.** Une requête, en-têtes et corps, doit être lue en 10 s à compter de son premier
  octet, quel que soit le débit : un client qui envoie un octet toutes les 7 s est coupé à
  10 s (mesure de la revue du 2026-11-23 : `Bun.serve` coupe ce client à 11 993 ms ; le
  binaire d'avant ce lot le gardait au-delà de 35 s, chaque octet relançant l'inactivité).
  Entre deux requêtes et pendant l'écriture d'une réponse, l'inactivité est bornée à 10 s.
  Une connexion qui n'a encore envoyé **aucun octet** est fermée après 3 s
  (`Limits::first_byte`). **Écart avec Bun**, qui lui laisse 10 s : une connexion muette tient
  une place trois fois moins longtemps, ce qui triple le débit de connexions nécessaire pour
  tenir toutes les places (ci-dessous). Une requête commencée garde sa borne de 10 s.
  **Limite nommée** : un client qui lit lentement une grande réponse fait progresser
  l'écriture et n'est borné que par cette inactivité, à chaque écriture ; seul l'arrêt
  l'abandonne. À SIGTERM, le binaire cesse d'accepter, laisse 10 s aux connexions ouvertes puis
  les abandonne (`server.connections_abandoned`, tenu par un test du processus avec un tel
  lecteur lent), puis laisse 30 s aux envois en cours ; un client lent ne retient donc jamais
  le processus au-delà de ces deux bornes.
- **Plafond de connexions.** Au plus 512 connexions ouvertes à la fois ; au-delà, une
  connexion attend une place dans la file d'écoute du système, sans prendre de descripteur. La
  borne de requête rend en 10 s la place d'une requête lente. **Pas de plafond par client** :
  un premier essai à 16 connexions par adresse a fait échouer 4 pages Firefox de la suite e2e
  (`NS_ERROR_NET_RESET`, run 45267348483), Chromium et WebKit restant verts. Cause inférée,
  non mesurée : les connexions persistantes que Firefox garde ouvertes après chaque contexte
  de test dépassent 16 en moins des 10 s d'inactivité. Des navigateurs derrière une même
  adresse (NAT, CGNAT) feraient de même, et derrière un proxy tous les clients partagent une
  adresse. **Risque résiduel** : une seule adresse peut occuper les 512 places, par des
  connexions muettes renouvelées toutes les 3 s, des requêtes lentes renouvelées toutes les
  10 s ou des lectures lentes de grandes réponses. Une fois les 512 places et la file d'écoute
  pleines, **tout nouveau client est refusé** (`ECONNRESET` sous macOS ; sous Linux, la demande
  est ignorée et le client attend, hypothèse non mesurée). Mesures datées du 2026-11-23, macOS,
  binaire de debug, boucle locale :
  - revue 3 de #25, avant la borne de premier octet : vers 640 sockets muettes depuis une
    adresse, toute requête légitime est refusée ; à 600, elle attend jusqu'à 9 s ; tenir les
    places coûtait environ 51 nouvelles connexions par seconde ;
  - après la borne de 3 s (sonde de ce lot : N sockets muettes, chacune rouverte dès que le
    serveur la ferme, une requête légitime toutes les 2 s, 20 s par palier) : à 600 sockets,
    3 672 connexions ouvertes en 20 s (184 par seconde), requêtes légitimes servies en 1 à
    2 s ; à 640 et à 700 sockets, 5 requêtes légitimes sur 8 et 8 sur 10 refusées
    (`ECONNRESET`). Le seuil en sockets ne bouge pas ; le débit de connexions qu'il exige passe
    d'environ 51 à 184 par seconde.
  Le plafond par client relève du proxy de tête, qui connaît le client ; le jalon de
  déploiement le pose. **Bloquant pour le déploiement** : avant toute mise en ligne, le jalon
  de déploiement **rejoue cette mesure à travers le proxy de tête réel** (sockets muettes
  depuis une adresse, requêtes légitimes depuis une autre) ; sans cette preuve, pas de
  lancement.
  **Hypothèse non mesurée** : que la limite de descripteurs du déploiement dépasse 512 plus les
  connexions à la base et au relais.
- **Corps illisible.** Une lecture du corps qui échoue (délai dépassé, connexion coupée) ne
  reçoit aucune réponse : la connexion est fermée, comme le fait `Bun.serve`. Seul un corps
  trop long reçoit 413.
- **PostgreSQL chiffré et vérifié.** Le binaire refuse de démarrer si la connexion ne demande
  pas `sslmode=verify-full` (dans l'URI ou par `PGSSLMODE`) : sans elle, sqlx retombe en clair
  et ne vérifie ni certificat ni nom d'hôte. Exception nommée, pour les tests et la
  démonstration : `POSTGRESQL_ALLOW_INSECURE_LOCAL=1`, valable seulement vers une boucle locale
  ou un socket. Les racines de confiance sont celles du système (`tls-rustls-ring-native-roots`).
  **Hypothèse non mesurée** : que l'URI fournie par Clever Cloud (`POSTGRESQL_ADDON_URI`) porte
  `sslmode=verify-full`, et que le certificat de l'addon soit signé par une autorité des
  racines du système. Le jalon de déploiement la vérifie ; à défaut, il pose
  `PGSSLMODE=verify-full` et, si l'autorité n'est pas dans les racines, `PGSSLROOTCERT`.
- **Limiteur.** Un client IPv6 est compté par son /64 (une ligne d'abonné reçoit en général un
  /64 entier ; compté par adresse, il pourrait changer de clé à chaque requête) ; une adresse
  IPv4 projetée en IPv6 compte comme IPv4. Les fenêtres expirées sortent par une file ordonnée,
  sans parcours de la table, et la table suit au plus 100 000 clients. Table pleine, la fenêtre
  la plus ancienne sort pour faire place au nouveau client, qui n'est jamais refusé faute de
  place. **Risque résiduel** : un attaquant à 100 000 clés réinitialise les fenêtres des
  autres. **Reste ouvert avant le déploiement** : aucune
  limite par adresse électronique ; une adresse en attente reçoit un message par demande
  acceptée.
- **Purge au démarrage**, avant d'écouter, puis toutes les heures.
- **Jetons.** La parité vérifie que chaque jeton du port porte 32 octets, ne se répète pas dans
  l'exécution et n'apparaît dans aucune exécution de la référence ; cela exclut un jeton
  constant ou rejoué, pas un jeton prévisible. L'imprévisibilité n'est tenue que par
  `tokens.rs` (générateur du système d'exploitation).
- **Politique d'en-têtes.** Un en-tête de sécurité de `policy.json` qui ne peut pas être envoyé
  (nom ou valeur invalide) fait échouer le démarrage, au lieu d'être omis en silence des
  réponses.
- **Aucun secret dans un journal** : `Debug` de la configuration masque l'URI de la base et le
  mot de passe SMTP.
- **Expiration à 48 h.** Le test de parité vieillit les demandes à la seconde : un scénario
  purge et confirme à 48 h moins 30 s, puis à 48 h plus 30 s. Un `PENDING_TTL` décalé de deux
  minutes, dans un sens ou dans l'autre, le fait rougir. La résolution tenue est donc
  d'environ ±30 s, pas plus fine : un décalage de +20 s passe (mesure de la revue 3 de #25).
- **Fraîcheur du binaire.** Le test de parité et les tests du processus refusent un binaire
  plus ancien que ses sources (`.rs`, `policy.json`). Pour les manifestes (`Cargo.toml` de la
  crate et de l'espace de travail, `Cargo.lock`), la date ne suffit pas : cargo compare leur
  contenu, et un manifeste réécrit sans changement qui le concerne laisse un binaire plus
  ancien que lui et pourtant à jour, qu'aucune construction ne rajeunit. Un manifeste plus
  récent que le binaire fait donc demander son verdict à cargo (`cargo build --offline
  --message-format=json`, champ `fresh`), qui reconstruit au passage un binaire périmé. Hors
  ligne, ce verdict exige toutes les crates de `Cargo.lock` dans le cache cargo local
  (`CARGO_HOME`, par défaut `~/.cargo`) : `bun run test` le remplit en construisant en ligne
  d'abord ; sinon, `cargo fetch --locked`, ou `CARGO_HOME` pointé sur un cache complet. Faute de
  quoi le test échoue sur `site_server.cargo_failed`, avec ce remède dans le message. Limite :
  pour les sources, la comparaison porte sur les dates, comme celle de cargo ; un fichier
  restauré avec une date ancienne passe pour plus vieux que le binaire, et ni cargo ni ce
  contrôle ne le voient.
- **Dépendances.** `url` reste en 2.5.8 : 2.5.9 a été publiée le 2026-11-20 à 23:03 UTC, moins
  de trois jours avant la mesure (garde d'âge de la flotte).

## Non comparé

Temps de réponse, mémoire, concurrence ; le transport SMTP (les deux côtés écrivent dans une
boîte d'envoi ; le client SMTP Rust a ses tests contre un relais local) ; les pannes de base
(test Rust) ; un corps de plus de 64 Kio et une requête HTTP/1.1 sans Host (chaque pile les
refuse à sa façon) ; pour un scénario à divergence admise, les en-têtes, corps et journaux
(seuls statut, `Location`, lignes et messages le sont) ; ce que le binaire journalise avant
`server.listening` (sa première purge) et sa ligne d'arrêt, sans équivalent dans la référence.

## Conséquences

- Le dépôt porte un espace de travail Cargo (`Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`)
  et le `deny.toml` commun de la flotte ; `bun run check` exécute `check:dependency-policy`
  (cargo-deny : bans, licences, sources) et `check:rust` (fmt, clippy `-D warnings`, tests).
- Le limiteur reste indexé sur l'adresse de la connexion (son /64 en IPv6). Derrière un
  proxy, toutes les requêtes partageraient une clé : le limiteur refuserait tout le monde
  après 5 demandes en 10 minutes. **Bloquant pour le déploiement** : le jalon de déploiement
  doit décider de l'adresse de client à croire avant la mise en ligne, poser au proxy de tête
  le plafond de connexions par client, et rejouer à travers ce proxy la mesure des sockets
  muettes d'une seule adresse (« Plafond de connexions ») ; sans cette preuve, pas de
  lancement.
- Les requêtes sqlx sont non préparées (`persistent(false)`), pour PGlite et les poolers.
- `tools/clever` est inchangé : il ne déploie qu'une cible statique ; le déploiement du binaire
  relève du jalon de déploiement.
