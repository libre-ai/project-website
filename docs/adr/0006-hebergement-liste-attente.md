# ADR 0006 — Une app Bun sert le site et tient la liste d'attente

- **Statut** : accepté par le propriétaire le 2026-11-09 (décisions 1 et 3 de la recette du
  prototype v4 ; plan de mise en ligne v1, même jour).
- **Portée** : site public `libre-ia.fr` ; le déploiement lui-même relève d'un jalon ultérieur.
- **Amende** : `docs/apps/website.md` (§Data : « No personal data or runtime database is
  owned » ; §Non-goals ; runtime « Caddy statique »), ADR 0001 (aucun service déployé).

## Contexte

La conversion arbitrée est une liste d'attente maison, en plus de la contribution GitHub. Elle
exige un serveur et une base : le site n'est plus seulement un artefact statique. Le domaine
canonique est `libre-ia.fr` ; `libre-ai.fr`, `libreia.fr` et les `www.` des trois redirigent.

## Décision

1. **Un processus `Bun.serve`** sert les fichiers générés (`site/`) avec les en-têtes de sécurité
   et expose trois routes, seules dynamiques : `POST /inscription`, `GET /confirmer`,
   `GET|POST /desinscrire` (désinscription en un clic, RFC 8058). Tout hôte autre que
   `libre-ia.fr` reçoit une redirection 301 vers `https://libre-ia.fr` et le même chemin.
2. **Une seule politique d'en-têtes**, définie une fois dans le code ; le `Caddyfile` conservé
   pour la cible statique en est vérifié identique par un test. CSP : `script-src 'self'`,
   `form-action 'self'`, le reste inchangé.
3. **Données** (PostgreSQL, accès par `Bun.sql`, sans ORM) : une table `subscribers` — adresse
   normalisée, état `pending | confirmed`, horodatages ISO 8601, empreinte SHA-256 du jeton
   (jamais le jeton en clair), version du texte de consentement, centres d'intérêt facultatifs
   (univers, application suivie, testeur). Rien d'autre.
4. **Cycle** : double confirmation ; une demande non confirmée expire à 48 h et est purgée ; une
   désinscription **supprime** la ligne. Réponse identique que l'adresse soit nouvelle, en attente
   ou confirmée (aucune énumération).
5. **Anti-abus** : champ piège, limitation par adresse IP en mémoire, corps de requête borné.
6. **Journaux** : aucune adresse e-mail, aucun jeton, aucune IP en clair.
7. **Envoi** : SMTP Infomaniak en production. Ce jalon livre l'interface d'envoi et une boîte
   d'envoi locale (fichiers `.eml`) pour la démonstration ; le transport SMTP et son secret
   relèvent du jalon de déploiement.
8. **Base de production** : PostgreSQL Clever dédié et sauvegardé (le plan DEV gratuit, sans
   sauvegarde, est exclu : la preuve de consentement disparaîtrait avec lui). **Base locale et
   de test** : PGlite exposé en protocole PostgreSQL sur un port local, pour que les tests
   d'intégration tournent partout, CI comprise, sans service externe.

## Hors de ce jalon

Création de l'app et de la base Clever, DNS Infomaniak (SPF, DKIM, DMARC compris), secret SMTP,
déploiement gardé par `tools/clever`, smoke sur les six hôtes : actes du jalon de déploiement.

## Conséquences

- `docs/apps/website.md` est amendé : le site possède des données personnelles (la liste) et un
  runtime. Les non-buts « account, profile, comments, analytics » restent.
- L'e2e est servi par ce processus, pour que la CSP et les en-têtes soient vérifiés dans les
  navigateurs, et non par un serveur de fichiers sans en-têtes.
