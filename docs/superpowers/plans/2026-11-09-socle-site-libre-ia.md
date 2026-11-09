# Socle de production du site libre-ia.fr — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** reconstruire dans ce dépôt le site arbitré pendant la recette du prototype v4 (identité
Aube, 40 applications, univers, parcours, fabrique, liste d'attente) comme socle de production,
démontrable en local, sans déploiement.

**Architecture :** le générateur statique existant (fonctions TypeScript qui renvoient du HTML
échappé) écrit les pages, une feuille de style, un sprite SVG et un module client ; un processus
`Bun.serve` sert ces fichiers avec les en-têtes de sécurité et tient la liste d'attente
(PostgreSQL par `Bun.sql`). En local et en test, PostgreSQL est PGlite exposé en protocole réseau ;
les e-mails partent dans une boîte d'envoi de fichiers `.eml`.

**Tech Stack :** Bun 1.4.0-canary.1 (épinglé), TypeScript 7 strict, Biome 2.5.3, `bun test`,
Playwright 1.64 + axe-core 4.13, PGlite 0.5.15 + pglite-socket 0.2.18 (tests et démo),
`@fontsource-variable/bricolage-grotesque` 5.3.0 et `@fontsource-variable/source-sans-3` 5.3.0.

**Spec :** ADR 0004 (identité), 0005 (JavaScript), 0006 (hébergement et liste d'attente), 0007
(contenu), dans `docs/adr/`. Brief validé le 2026-11-09 :

- **Objectif** : reconstruire le site arbitré, liste d'attente comprise, en démo locale sans
  déploiement.
- **Invariants** : zéro style en ligne et CSP stricte, polices auto-hébergées, site complet sans
  script, aucun produit présenté comme disponible, aucune adresse e-mail dans les journaux, une
  ADR par écart de doctrine.
- **Critère de fin** : contrôles du dépôt à zéro, tests unitaires et e2e sur trois navigateurs,
  zéro violation axe, régression visuelle, budgets de poids imprimés et tenus, revue de code.

## Global Constraints

- Bun : `packageManager` `bun@1.4.0-canary.1`, `engines.bun` `>=1.4.0` ; toute dépendance ajoutée
  est une version exacte publiée depuis au moins 3 jours (`bunfig.toml` `minimumReleaseAge = 259200`).
- Aucune dépendance d'exécution côté client ; côté serveur, aucune hors de Bun.
- Licences : code EUPL-1.2, textes CC-BY-4.0, polices OFL-1.1 livrées avec leur licence ; chaque
  fichier ajouté est couvert par `REUSE.toml` ou un en-tête SPDX (`reuse lint` vert).
- CSP (une seule source, `src/headers.ts`) : `default-src 'self'; base-uri 'none'; connect-src
  'none'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src
  'self'; manifest-src 'none'; media-src 'none'; object-src 'none'; script-src 'self'; style-src
  'self'; worker-src 'none'`.
- HTML généré : aucun attribut `style`, aucun élément `<style>`, aucun script en ligne, aucune
  ressource distante.
- Origine canonique : `https://libre-ia.fr` ; hôtes redirigés en 301 : `libre-ai.fr`,
  `libreia.fr`, `www.libre-ia.fr`, `www.libre-ai.fr`, `www.libreia.fr`.
- Copie : français ; nom « Libre IA » ; applications « Libre X » ; promesse « Ce que chacun
  réinvente seul, faisons-le ensemble. » ; « Vos outils. Vos données. Votre IA. » ; « Décrivez un
  besoin, la fabrique le construit, tout le monde en profite. »
- Interdits de copie sur les pages générées : « disponible », « télécharger », « essayer
  maintenant », « bêta ouverte », tout nombre de dépôts, d'applications ou de pourcentage
  d'avancement (ADR 0007).
- Visuels de résultat marqués « Illustration » (I-15).
- Mouvement : tout s'arrête sous `prefers-reduced-motion: reduce`.
- Journaux serveur : aucune adresse e-mail, aucun jeton, aucune IP.
- Budgets, mesurés sur la sortie du build et imprimés à chaque build : page (HTML + CSS + polices +
  script + sprite qu'elle référence) ≤ 120 Kio **compressés gzip** ; script client ≤ 16 Kio non
  compressé ; feuille de style ≤ 48 Kio non compressée ; sprite ≤ 80 Kio non compressé.
- Gates : chaque contrôle imprime le volume examiné ; une source déclarée illisible est un échec.
- Identifiants de code en anglais, copie et docs en français ; commits en anglais, `git commit -s`.

## Review Focus

1. **Adresse e-mail limite** (majuscules, espaces autour, IDN, 254 caractères, `+étiquette`) : la
   même personne ne doit avoir qu'une ligne ; la normalisation ne doit jamais rendre deux adresses
   différentes identiques hors casse du domaine. → test `normalizes case of the domain only` (Tâche 10).
2. **Lien de confirmation ouvert deux fois, ou après désinscription** : la seconde ouverture mène à
   « lien expiré ou déjà utilisé », jamais à une erreur 500. → test `second confirmation is
   idempotent` (Tâche 11).
3. **Scanner de liens d'un fournisseur de messagerie** qui suit `GET /desinscrire` : aucune
   suppression sans `POST`. → test `GET /desinscrire never deletes` (Tâche 13).
4. **Bascule de thème choisie puis navigation** : aucun flash du mauvais thème au chargement. →
   test e2e `saved dark theme paints dark on first frame` (Tâche 15).
5. **Visiteur sans JavaScript sur la page d'une application** : formulaire d'attente utilisable,
   onglets lisibles en sections, visite guidée lisible en liste. → projet e2e `chromium-no-js` sur
   toutes les routes (Tâche 15).

---

## Structure des fichiers

| Chemin | Responsabilité |
|---|---|
| `src/design/palette.ts` | OKLCH → sRGB, ratio de contraste WCAG, teintes d'univers |
| `src/design/tokens.ts` | variables CSS clair/sombre, classes `.univers-<id>` |
| `src/design/css/*.css` | feuilles statiques : base, mise en page, composants, effets, démos |
| `src/design/stylesheet.ts` | assemble `@font-face`, jetons, feuilles statiques, règles générées |
| `src/brand/martinet.ts` | tracés du martinet (une seule copie), logotype |
| `src/brand/birds.ts` | oiseaux origami paramétriques (porté du prototype) |
| `src/brand/sprite.ts` | sprite `assets/volee.svg` : martinet + 40 oiseaux en `<symbol>` |
| `src/content/universes.ts` | 8 univers par verbe |
| `src/content/applications.ts` | 40 applications (réf., slug, nom, univers, promesse, statut du nom) |
| `src/content/showcases.ts` | libellé de fonction, 3 étiquettes, micro-démo par application |
| `src/content/journeys.ts` | parcours « Je veux… » |
| `src/content/factory.ts` | visite guidée (7 étapes) et couches |
| `src/content/socials.ts` | réseaux : adresse ou `null` |
| `src/content/validate.ts` | validation croisée du contenu, copie interdite |
| `src/web/html.ts` | `h()`/`attrs()` : construction HTML échappée |
| `src/web/layout.ts` | document, en-tête, navigation, bascule de thème, pied |
| `src/web/components.ts` | tuile, carte, onglets, accordéon, formulaire d'attente |
| `src/web/pages/*.ts` | accueil, applications, application, fabrique, rejoindre, à propos, confidentialité, inscription |
| `src/web/routes.ts` | table des routes générées |
| `src/web/site.ts` | `buildLibreSite()` : pages + assets + rapport |
| `src/web/gates.ts` | style en ligne, copie interdite, liens internes |
| `src/client/*.ts` | thème, onglets, seul/ensemble, visite, explorateur, inclinaison ; `main.ts`, `theme-init.ts` |
| `src/headers.ts` | politique d'en-têtes unique |
| `server/*.ts` | liste d'attente : domaine, stockage, envoi, HTTP, démo |
| `e2e/*.e2e.ts` | parcours, accessibilité, CSP, liste d'attente, régression visuelle |

Réutilisés tels quels : `src/security.ts`, `src/determinism.ts`, `src/cards-snapshot.ts`,
`src/fetch-cards.ts`, `src/licences.ts`, `src/deploy.ts`, `src/presentation.ts`,
`src/project-card.ts`, `src/claims.ts`, `src/universe.ts`, `src/feed.ts`. Retirés à la Tâche 9 :
`src/templates.ts`, `src/build.ts` (générateur de marque legacy), `src/pages/{home,offres,method}.ts`,
`src/comparisons.ts`, et leurs tests.

## Environnement local (à lire avant la Tâche 1)

- Composition : `run-composition.py` de `project-governance` à l'outillage épinglé dans
  `.github/workflows/code-validation.yml` (`tooling_ref`), racine canonique (`pwd -P`). Le Bun
  exact s'installe par l'installateur macOS documenté dans `src/data/deploy/LOCAL-COMPOSITION.md`.
- Sous le sandbox macOS : `reuse` exige `--no-multiprocessing` (shim local hors dépôt) ;
  `bun --no-env-file` ; Playwright exige `NODE_USE_ENV_PROXY=1` pour télécharger, et les
  navigateurs **ne démarrent pas** (Mach port refusé) : l'e2e se vérifie en CI.

---

### Task 1: ADR et contrats amendés

**Files:**
- Create: `docs/adr/0004-identite-martinet-aube.md`, `0005-javascript-amelioration-progressive.md`,
  `0006-hebergement-liste-attente.md`, `0007-contenu-promesse-fabrique-en-commun.md`
- Modify: `docs/adr/0002-*.md`, `docs/adr/0003-*.md` (statut « remplacé par »), `docs/adr/0001-*.md`
  (statut « amendé par 0005, 0006 »), `docs/apps/website.md` (§Runtime, §Non-goals, §Data,
  §Refusal matrix), `AGENTS.md` (§Boundaries)

**Interfaces:** aucune.

- [ ] **Step 1:** ajouter en tête des ADR 0001, 0002, 0003 une ligne de statut renvoyant aux ADR qui les remplacent ou amendent.
- [ ] **Step 2:** amender `docs/apps/website.md` : runtime `Bun.serve` (site + liste d'attente) ;
  §Data : la liste d'attente est la seule donnée personnelle, champs de l'ADR 0006 ; retirer « No
  personal data or runtime database is owned » ; ajouter les refus `website.subscription_invalid`
  et `website.subscription_rate_limited`.
- [ ] **Step 3:** `AGENTS.md` : remplacer « No deployed service and no client JavaScript » par
  « Client JavaScript is progressive enhancement only (ADR 0005); the waitlist server is the only
  runtime (ADR 0006); deployment tooling under `tools/clever/` is not run for verification ».
- [ ] **Step 4:** `bun run check` → exit 0 ; `git commit -s -m "docs(adr): identity, client script, waitlist hosting and content decisions"`.

### Task 2: Palette Aube et jetons

**Files:**
- Create: `src/design/palette.ts`, `src/design/tokens.ts`, `src/design/palette.test.ts`, `src/design/tokens.test.ts`

**Interfaces:**
- Produces: `oklchToHex(l: number, c: number, hueDegrees: number): string` ;
  `contrastRatio(foreground: string, background: string): number` ;
  `universeHue(id: UniverseId): number` ; `AUBE` (`fond`, `surface`, `encre`, `emeraude`, `ciel`,
  `lagon`) ; `renderTokens(): string` (CSS : `:root`, `[data-theme="sombre"]`,
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="clair"]) }`, puis une classe
  `.univers-<id>` par univers posant `--couleur`, `--teinte`, `--couleur-texte`) ;
  `TOKEN_PAIRS: readonly { name: string; foreground: string; background: string; minimum: 3 | 4.5 }[]`.
- Consumes: `UniverseId` de la Tâche 4 — pour ne pas inverser l'ordre, cette tâche déclare
  `UNIVERSE_HUES: Readonly<Record<string, number>>` et la Tâche 4 vérifie que ses clés égalent les ids.

- [ ] **Step 1: tests**

```ts
test("oklchToHex reproduces reference points", () => {
  expect(oklchToHex(1, 0, 0)).toBe("#ffffff");
  expect(oklchToHex(0, 0, 0)).toBe("#000000");
});
test("contrastRatio matches WCAG reference", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
});
test("every declared token pair meets its minimum in light and dark", () => {
  for (const pair of TOKEN_PAIRS) expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(pair.minimum);
});
test("Aube base colours are the arbitrated values", () => {
  expect(AUBE).toMatchObject({ fond: "#f4f8f6", encre: "#0a2a1e", emeraude: "#0ba360", ciel: "#3cb9e8" });
});
test("renderTokens is deterministic and declares one class per universe hue", () => { /* deux appels égaux ; 8 `.univers-` */ });
```

- [ ] **Step 2:** `bun test src/design` → FAIL (modules absents).
- [ ] **Step 3:** implémenter. `oklchToHex` : la conversion du prototype
  (`prototype-v2-2026-11-09/palette.ts`, matrices OKLab de Björn Ottosson), arrondi par canal.
  `contrastRatio` : luminance relative WCAG 2.2 (seuil 0,04045). Les paires couvrent : encre/fond,
  encre/surface, texte atténué/fond, émeraude foncée (liens)/fond, `--couleur-texte` de chaque
  univers/sa teinte, et leurs équivalents sombres. Une teinte d'univers qui échoue se corrige en
  baissant la luminance de `--couleur-texte`, jamais en abaissant le seuil.
- [ ] **Step 4:** `bun test src/design` → PASS ; commit `feat(design): Aube palette with verified contrast`.

### Task 3: Polices auto-hébergées

**Files:**
- Modify: `src/font.ts`, `src/font.test.ts`, `package.json`, `bun.lock`, `REUSE.toml`

**Interfaces:**
- Produces: `FONTS: readonly { family: string; file: string; licenseFile: string; packageDir: string }[]`
  (Bricolage Grotesque, Source Sans 3) ; `renderFontFaces(): string`.

- [ ] **Step 1:** test `renderFontFaces declares both families with local urls only` (deux
  `@font-face`, `font-display: swap`, `url("/assets/fonts/...woff2")`, aucun `http`).
- [ ] **Step 2:** FAIL ; puis `bun add -d --exact @fontsource-variable/bricolage-grotesque@5.3.0`.
- [ ] **Step 3:** implémenter ; Bricolage : fichier latin `wght` normal, axe `opsz` non utilisé.
  Le build copiera chaque fichier et sa licence (Tâche 9).
- [ ] **Step 4:** PASS ; commit `feat(fonts): self-host Bricolage Grotesque next to Source Sans 3`.

### Task 4: Contenu — univers, applications, vitrines, parcours, fabrique, réseaux

**Files:**
- Create: `src/content/{universes,applications,showcases,journeys,factory,socials,validate}.ts`,
  `src/content/validate.test.ts`

**Interfaces:**
- Produces:
  - `type UniverseId = "s-informer" | "ecrire-calculer" | "travailler-ensemble" | "creer-publier" | "apprendre" | "se-divertir" | "se-proteger" | "piloter-ia"` ;
    `UNIVERSES: readonly { id: UniverseId; verb: string; tagline: string }[]` (ordre de l'ADR 0007).
  - `interface Application { ref: \`P${string}\`; slug: string; name: string; universe: UniverseId; promise: string; nameStatus: "tranché" | "provisoire"; species: string }` ; `APPLICATIONS: readonly Application[]`.
  - `interface Showcase { category: string; tags: readonly [string, string, string]; demo: DemoSpec }` où `DemoSpec` est une **donnée** (type de démo + textes), jamais du HTML ; `SHOWCASES: Readonly<Record<string, Showcase>>`.
  - `JOURNEYS`, `TOUR_STEPS` (7), `LAYERS` (gouvernance → fabrique → harnais → identité →
    confinement → preuve → briques → applications), chacun en données (pas de HTML).
  - `SOCIALS: Readonly<Record<"github" | "discord" | "linkedin", string | null>>` = `{ github: "https://github.com/libre-ai", discord: null, linkedin: null }`.
  - `src/content/consent.ts` : `CONSENT_TEXT_VERSION = "2026-11-09"` et `CONSENT_TEXT` (mention
    affichée sous le formulaire : usage limité à la liste, confirmation par e-mail,
    désinscription en un clic, lien vers `/confidentialite/`).
  - `validateContent(): { examined: number; violations: readonly string[] }`.
- Répartition provisoire (à confirmer par le propriétaire, ADR 0007 §Conséquences) :
  S'informer P01 P02 P03 P06 · Écrire et calculer P04 P08 P09 P10 P12 P13 · Travailler ensemble
  P05 P11 P14 P15 P16 P17 P18 P19 P20 P21 · Créer et publier P22–P27 · Apprendre P07 P39 ·
  Se divertir P28–P32 · Se protéger P36 P37 P38 · Piloter l'IA P33 P34 P35 P40.
  Noms tranchés : P01 Sources, P03 Corpus, P14 Canevas, P28 Tempo, P29 Antenne, P39 Cours ; les
  autres repris du prototype (`data.ts`), `nameStatus: "provisoire"`.

- [ ] **Step 1: tests**

```ts
test("40 applications, refs P01 to P40 exactly once", () => { /* ensemble des réfs = P01..P40 */ });
test("slugs are unique and url-safe", () => { /* /^[a-z0-9-]+$/ */ });
test("every application belongs to a declared universe and has a showcase and a species", () => {});
test("the six arbitrated names are marked tranché, all others provisoire", () => {});
test("every universe has at least one application", () => {});
test("tour has 7 steps; layers are in the arbitrated order", () => {});
test("journeys reference only existing application slugs", () => {});
test("no content string contains forbidden availability wording or a count", () => {
  expect(validateContent().violations).toEqual([]);
});
test("validateContent reports what it examined", () => { expect(validateContent().examined).toBeGreaterThan(0); });
test("UNIVERSE_HUES keys equal universe ids", () => {});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** porter le contenu du prototype (`data.ts`, `vignettes.ts`, `story.ts`,
  `fabrique.ts`) en **données** : les micro-démos deviennent des `DemoSpec`
  (`kind: "liste" | "carte" | "flashcard" | "tableau" | ...` + textes), rendues par la Tâche 6.
  Les noms de personnes des démos sont des initiales fictives.
- [ ] **Step 4:** PASS ; commit `feat(content): 40 applications, eight universes, journeys and factory tour as data`.

### Task 5: Marque — martinet, oiseaux, sprite

**Files:**
- Create: `src/brand/{martinet,birds,sprite}.ts`, `src/brand/sprite.test.ts`, `src/brand/martinet-paths.ts`

**Interfaces:**
- Produces: `MARTINET_PATHS: { body: string; wing: string }` (extraits une fois de l'identité
  d'origine `<workspace>/assets/references/legacy/design-system-c8fb246/identity/libre-ia-icon-dark.svg`,
  repère 1254 × 1254, transformation `translate(0,1254) scale(0.1,-0.1)`) ;
  `martinetUse(label: string | null): string` (`<svg><use href="/assets/volee.svg#martinet"/></svg>`,
  `role="img"` + `aria-label` si `label`, sinon `aria-hidden="true"`) ; `logotype(): string` ;
  `birdUse(slug: string): string` ; `renderSprite(): string` (un `<symbol id="martinet">`, un
  `<symbol id="oiseau-<slug>">` par application) ; `SPRITE_PATH = "assets/volee.svg"`.

- [ ] **Step 1: tests**

```ts
test("sprite holds the martinet and one symbol per application", () => { /* 41 <symbol> ; ids = martinet + oiseau-<slug> */ });
test("sprite is deterministic", () => { expect(renderSprite()).toBe(renderSprite()); });
test("sprite carries no style attribute and no script", () => {});
test("martinet paths appear only in the sprite", () => { /* martinetUse() ne contient pas MARTINET_PATHS.body */ });
test("bird colours come from universe classes, not literals", () => { /* fill="var(--facette-N)" */ });
test("sprite stays under 80 KiB", () => { expect(new TextEncoder().encode(renderSprite()).length).toBeLessThanOrEqual(80 * 1024); });
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** porter `birds.ts` du prototype ; remplacer les couleurs littérales par
  `var(--facette-1)` … `var(--facette-5)` et `var(--encre)`, posées par `.univers-<id>` (Tâche 2) ;
  arrondir les coordonnées à 1 décimale. Le corps du martinet prend `fill="url(#aube-degrade)"`,
  dégradé déclaré dans le sprite.
- [ ] **Step 4:** PASS ; commit `feat(brand): martinet and origami birds in one external sprite`.

### Task 6: HTML — construction échappée, gabarit, composants

**Files:**
- Create: `src/web/{html,layout,components}.ts` + tests

**Interfaces:**
- Produces: `h(tag: string, attributes: Attrs, ...children: Html[]): Html` où
  `type Html = { readonly __html: string }` et le texte brut passe par `escapeHtml` ;
  `raw(trusted: string): Html` réservé aux SVG du sprite ; `toString(html: Html): string`.
  `layout(page: { title: string; description: string; path: string; main: Html }): string` ;
  composants : `appTile(app)`, `appCard(app)`, `universeTabs(universes, applications)`,
  `journeyAccordion(journeys)`, `waitlistForm(options: { follow: Application | null; idSuffix: string })`,
  `demo(spec: DemoSpec)`, `themeToggle()`.
- Règles fixées :
  - en-tête : marque (martinet + logotype), navigation « Parcours · Applications · Comment c'est
    fait · À propos », bouton de thème (`hidden`, révélé par le script, `aria-pressed`, nom
    accessible « Thème sombre », icônes soleil/lune en SVG), lien « Liste d'attente » ;
  - pied : univers, comprendre (parcours, fabrique, à propos, preuves, corrections, licences,
    confidentialité), rejoindre (liste d'attente + réseaux non nuls de `SOCIALS`) ;
  - `<head>` : `theme-init.js` (bloquant, en premier), feuille unique, `main.js` en
    `type="module"`, favicon `assets/martinet.svg` (SVG autonome : un `<use>` vers le sprite ne
    sert pas de favicon) ;
  - onglets sans script : une `<nav>` d'ancres + une `<section>` titrée par univers ; le script
    pose `role="tablist"`/`tab`/`tabpanel` (Tâche 8) ;
  - formulaire : `method="post" action="/inscription"`, `<label>` visibles, `autocomplete="email"`,
    champ piège `site` hors écran (`.piege`, `tabindex="-1"`, `aria-hidden`), mention de
    consentement `CONSENT_TEXT` (Tâche 4).

- [ ] **Step 1: tests** — `h escapes text and attribute values`, `layout has exactly one h1 slot
  and lang="fr"`, `layout links one stylesheet and two scripts, all local`, `theme toggle is
  hidden without script`, `waitlist form posts to /inscription with a labelled email field and a
  honeypot`, `footer shows only socials with an address`, `no component output contains style= or
  <style` (sur la sortie de chaque composant).
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS ; commit `feat(web): escaped HTML builder, layout and components`.

### Task 7: Pages et routes

**Files:**
- Create: `src/web/pages/{home,applications,application,factory,join,about,privacy,subscription}.ts`, `src/web/routes.ts`, `src/web/routes.test.ts`, `src/web/pages/pages.test.ts`
- Modify: `src/corpus.ts` (`SITE_ORIGIN = "https://libre-ia.fr"`, routes), `src/corpus.test.ts`

**Interfaces:**
- Produces: `ROUTES: readonly { path: string; render: () => string; kind: "page" | "forge" | "subscription" }[]`.
- Routes :
  `/` (premier écran « Chacun seul / Ensemble », univers en onglets, parcours, fabrique en bref,
  liste d'attente) ; `/applications/` ; `/applications/<slug>/` ×40 ; `/fabrique/` (visite +
  couches + briques) ; `/fabrique/briques/<repo>/` ×15 (pages produit existantes, rendues dans le
  nouveau gabarit) ; `/rejoindre/` ; `/a-propos/` (mission, méthode, gouvernance, contribuer) ;
  `/confidentialite/` ; `/preuves/`, `/corrections/`, `/licences/`, `/deployer/`, `/signaler/`
  (corps existants, nouveau gabarit) ; `/inscription/merci/`, `/inscription/confirmee/`,
  `/inscription/desinscrit/`, `/inscription/lien-invalide/`, `/inscription/erreur/`
  (`noindex`, hors sitemap) ; `/404.html` (servie par le serveur sur toute route inconnue, hors
  sitemap).
- Premier écran sans script : `<fieldset>` « Comment voulez-vous avancer ? » avec deux radios
  « Chacun seul » / « Ensemble » ; l'état visuel suit `:has(#ensemble:checked)`.

- [ ] **Step 1: tests** — `routes are unique and end with a slash`, `sitemap lists every page and
  forge route and no subscription route`, `every page has one h1 and a description`, `every
  application page links back to its universe and offers the waitlist`, `no page offers a
  download, a trial or an availability claim`, `every illustration carries the Illustration
  label`, `subscription pages are noindex`, `old paths /mission /methode /produits /offres are
  absent` (décision ADR 0007 §10).
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS ; commit `feat(web): pages and route table for the Libre IA site`.

### Task 8: Feuille de style et module client

**Files:**
- Create: `src/design/css/{base,layout,components,effects,demos}.css`, `src/design/stylesheet.ts`,
  `src/client/{theme-init,theme,tabs,solo-together,tour,explorer,tilt,main}.ts`, tests de logique
  pure `src/client/{theme,tabs,tour}.test.ts`

**Interfaces:**
- Produces: `renderStylesheet(): string` ; `resolveTheme(saved: string | null, prefersDark: boolean): "clair" | "sombre"` ;
  `nextTabIndex(current: number, key: string, count: number): number | null` (flèches gauche/droite
  avec bouclage, `Home`, `End`, autre touche → `null`) ; `clampStep(index: number, count: number): number` ;
  `CLIENT_ENTRY = "src/client/main.ts"`, `THEME_INIT_ENTRY = "src/client/theme-init.ts"`.
- Effets (ADR 0005 §5) : transition de vue `document.startViewTransition` à la bascule
  seul/ensemble, `view-transition-name` posé par classe ; pli d'origami en CSS (`transform` sur
  les facettes) ; défilement scénarisé `animation-timeline: view()` dans `@supports` ; indicateur
  d'onglet glissant (variable CSS posée par le script via `CSSStyleDeclaration.setProperty`, ce que
  `style-src 'self'` autorise) ; `<details>` animés par `::details-content` sous `@supports` ;
  inclinaison des cartes au survol en CSS seul. Tout sous `@media (prefers-reduced-motion: no-preference)`.
- `theme-init.ts` lit `localStorage["libre-ia-theme"]` dans un `try/catch` et pose
  `document.documentElement.dataset.theme` avant la peinture.

- [ ] **Step 1: tests** — `resolveTheme prefers a valid saved choice, else the system`,
  `resolveTheme ignores an unknown saved value`, `nextTabIndex wraps and handles Home/End`,
  `clampStep keeps the tour inside 0..count-1`, `stylesheet declares no remote url and no @import`,
  `stylesheet wraps every animation in a reduced-motion guard` (aucune `animation:` hors bloc
  `prefers-reduced-motion: no-preference`).
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS ; commit `feat(client): progressive enhancement module and Aube stylesheet`.

### Task 9: Build — orchestration, gates, budgets, artefact versionné

**Files:**
- Create: `src/web/site.ts`, `src/web/gates.ts`, `src/web/gates.test.ts`, `src/web/site.test.ts`
- Modify: `src/build-site.ts`, `src/budget.ts`, `src/budget.test.ts`, `tools/clever/sync-site.ts`,
  `src/security.ts` (ajout `findInlineStyles`), `REUSE.toml`
- Delete: `src/templates.ts`, `src/build.ts`, `src/pages/{home,offres,method}.ts`, `src/comparisons.ts`, leurs tests, `src/preview.ts` et les scripts `build:brand`/`preview:brand`

**Interfaces:**
- Produces: `buildLibreSite(input: { cards; presentations; extras; proofs }): Promise<{ files: Map<string, string | Uint8Array>; report: SiteReport }>`
  — appelle `Bun.build` pour `main.js` et `theme-init.js` (`minify: true`, `target: "browser"`,
  sortie en mémoire) ; écrit `assets/site.css`, `assets/volee.svg`, `assets/martinet.svg`,
  `assets/fonts/*` + licences, pages, `sitemap.xml`, `robots.txt`, `atom.xml`.
  `findInlineStyles(html: string): readonly string[]` ;
  `checkCopy(pages): { examined: number; violations: string[] }` ;
  `checkInternalLinks(files): { examined: number; broken: string[] }`.
  `pageWeights` compte aussi les `<script src="/assets/...">` et les `<use href="/assets/...svg#…">`,
  et rend `{ page, bytes, gzipBytes }` (`Bun.gzipSync`, niveau 9).
- Sortie console : une ligne par gate avec ses compteurs (comme aujourd'hui), plus
  `NFR poids: N pages, la plus lourde <page> (<gzip> octets gzip sur 122880)`,
  `NFR script: <octets> sur 16384`, `NFR feuille: <octets> sur 49152`, `NFR sprite: <octets> sur 81920`,
  `ADR 0005 styles en ligne: <pages examinées>, violations: 0`,
  `ADR 0007 copie: <textes examinés>, violations: 0`, `liens internes: <n> examinés, 0 cassé`.
- `sync:deployment-artifact` réécrit `site/` depuis `buildLibreSite` (octet pour octet), à la place
  de l'ancien générateur.

- [ ] **Step 1: tests** — `findInlineStyles finds style attributes and style elements`,
  `checkCopy flags a forbidden word and a count`, `checkInternalLinks flags a link to an unwritten
  page`, `budget counts scripts and sprite`, `budget reports gzip bytes`, `two builds write the
  same bytes`, `site/ equals the generated output` (comparaison du dossier versionné).
- [ ] **Step 2:** FAIL. **Step 3:** implémenter ; supprimer l'ancien générateur ; régénérer `site/`
  par `bun run sync:deployment-artifact`.
- [ ] **Step 4:** `bun run check` → exit 0, chaque compteur imprimé ; commit `feat(build): Libre IA site build with style, copy, link and weight gates`.

### Task 10: Liste d'attente — domaine

**Files:**
- Create: `server/consent.ts`, `server/email.ts`, `server/tokens.ts`, `server/subscription.ts` + tests

**Interfaces:**
- Consumes: `CONSENT_TEXT_VERSION` (Tâche 4), `UNIVERSES`, `APPLICATIONS`.
- Produces: `normalizeEmail(input: string): string | null` (trim, domaine en minuscules et
  converti en ASCII par `domainToASCII` de `node:url`, partie locale intacte, ≤ 254 octets, une
  seule `@`, aucun espace ni caractère de contrôle) ;
  `newToken(): { token: string; hash: string }` (32 octets `crypto.getRandomValues`, base64url ;
  empreinte SHA-256 hex) ; `hashToken(token: string): string` ;
  `parseSubscription(form: FormData): { ok: true; value: SubscriptionRequest } | { ok: false; reason: "email" | "honeypot" | "field" }`
  où `SubscriptionRequest = { email: string; universes: UniverseId[]; follow: string | null; tester: boolean }`
  (univers et `follow` validés contre le contenu ; valeur inconnue → `field`).
- `PENDING_TTL_MS = 48 * 3600 * 1000`.

- [ ] **Step 1: tests** — `normalizes case of the domain only` (`Marie.Dupont@Example.ORG ` →
  `Marie.Dupont@example.org` ; le gate de données personnelles n'admet que les domaines RFC 2606), `rejects two @, spaces, control characters and 255 bytes`,
  `converts an IDN domain to ASCII`, `tokens are 43 base64url characters and hashes differ from
  tokens`, `honeypot filled is refused as honeypot`, `unknown universe or follow slug is refused
  as field`, `tester is true only for "oui"`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS ; commit `feat(waitlist): subscription domain, email normalisation and tokens`.

### Task 11: Liste d'attente — stockage PostgreSQL

**Files:**
- Create: `server/schema.sql`, `server/store.ts`, `server/test-database.ts`, `server/store.test.ts`
- Modify: `package.json`, `bun.lock` (`@electric-sql/pglite@0.5.15`, `@electric-sql/pglite-socket@0.2.18`, dev, exactes)

**Interfaces:**
- Produces: `interface WaitlistStore { request(input: SubscriptionRequest, confirmHash: string, unsubscribeHash: string, now: Date): Promise<"created" | "renewed" | "already-confirmed">; confirm(confirmHash: string, now: Date): Promise<"confirmed" | "invalid">; unsubscribe(unsubscribeHash: string): Promise<"deleted" | "invalid">; purgeExpired(now: Date): Promise<number>; }` ;
  `createPgStore(sql: Bun.SQL): WaitlistStore` ; `migrate(sql: Bun.SQL): Promise<void>` (exécute
  `schema.sql`, idempotent) ; `startTestDatabase(): Promise<{ url: string; stop(): Promise<void> }>`
  (PGlite en mémoire + `PGLiteSocketServer` sur `127.0.0.1`, port 0, `getServerConn()`).
- Schéma : `subscribers(email text primary key, state text not null check (state in ('pending','confirmed')), universes text[] not null, follow text, tester boolean not null, consent_version text not null, requested_at timestamptz not null, confirmed_at timestamptz, confirm_hash text unique, unsubscribe_hash text unique not null)`.
- `request` sur une ligne `pending` renouvelle les deux empreintes et `requested_at` ; sur une
  ligne `confirmed`, ne modifie rien et rend `already-confirmed` (l'appelant n'envoie rien) ;
  `confirm` vide `confirm_hash` et refuse une demande plus vieille que `PENDING_TTL_MS`.

- [ ] **Step 1: tests (contre `startTestDatabase()`)** — `request creates a pending row`,
  `request twice renews the hashes`, `request on a confirmed address changes nothing`,
  `confirm moves pending to confirmed`, `second confirmation is idempotent` (deuxième appel →
  `invalid`, aucune exception), `confirm refuses after 48 hours`, `unsubscribe deletes the row`,
  `unsubscribe with an unknown hash is invalid`, `purgeExpired deletes only pending rows older
  than 48 hours and returns their number`, `migrate is idempotent`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS ; commit `feat(waitlist): PostgreSQL store tested against PGlite over the wire protocol`.

### Task 12: Liste d'attente — messages et envoi

**Files:**
- Create: `server/messages.ts`, `server/mailer.ts`, tests

**Interfaces:**
- Produces: `confirmationMessage(input: { from: string; to: string; confirmUrl: string; unsubscribeUrl: string }): MailMessage`
  (`from` vient du réglage `WAITLIST_FROM`, obligatoire hors démo ; la démo et les tests utilisent
  une adresse en `example.org` ; aucune adresse réelle dans le code), sujet « Confirmez votre inscription à Libre IA »,
  texte brut UTF-8, en-têtes `List-Unsubscribe: <unsubscribeUrl>` et
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`) ; `toRfc5322(message: MailMessage, date: Date, messageId: string): string` ;
  `interface Mailer { send(message: MailMessage): Promise<void> }` ;
  `createOutboxMailer(directory: string): Mailer` (un fichier `<horodatage>-<n>.eml` par message).
  `shortcut: aucun transport SMTP dans ce jalon, déclencheur : jalon de déploiement (ADR 0006 §7)`.

- [ ] **Step 1: tests** — `confirmation carries one-click unsubscribe headers`, `rfc5322 output
  uses CRLF and encodes the subject`, `outbox writes one file per message`, `header injection: a
  CR or LF in any header value is refused`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS ; commit `feat(waitlist): confirmation message and local outbox mailer`.

### Task 13: Serveur HTTP

**Files:**
- Create: `src/headers.ts`, `server/limiter.ts`, `server/log.ts`, `server/http.ts`, `server/http.test.ts`, `server/main.ts`
- Modify: `Caddyfile`, `src/caddy-headers.ts`, `src/caddy-headers.test.ts`

**Interfaces:**
- Produces: `SECURITY_HEADERS: Readonly<Record<string, string>>` (CSP des Global Constraints,
  `Strict-Transport-Security: max-age=86400` sans `includeSubDomains`, le reste du Caddyfile
  actuel) ; `createLimiter(options: { limit: number; windowMs: number }): { allow(key: string, now: number): boolean }`
  (5 demandes / 10 min / IP) ; `createLogger(write: (line: string) => void): { event(name: string, fields?: Record<string, number | string>): void }`
  qui refuse toute valeur contenant `@` ;
  `createServer(options: { siteDirectory: string; origin: string; store: WaitlistStore; mailer: Mailer; limiter; logger; port: number }): Server`.
- Comportement :
  - hôte ≠ `libre-ia.fr` (hors `localhost`/`127.0.0.1` en démo) → 301 `https://libre-ia.fr` + chemin ;
  - fichiers : `site/` ; `gzip` si `Accept-Encoding` le permet (compressé une fois au démarrage) ;
    `Cache-Control: public, max-age=31536000, immutable` pour `/assets/`, `no-cache` ailleurs ;
    route inconnue → 404 avec `/404.html` ;
  - `POST /inscription` : corps ≤ 4 Kio, `Content-Type: application/x-www-form-urlencoded`,
    `Sec-Fetch-Site` absent ou `same-origin` ; piège → 303 `/inscription/merci/` sans écrire ;
    limiteur → 429 ; invalide → 303 `/inscription/erreur/` ; sinon `store.request` puis envoi si
    `created`/`renewed` ; **toujours** 303 `/inscription/merci/` ;
  - `GET /confirmer?jeton=` → 303 `/inscription/confirmee/` ou `/inscription/lien-invalide/` ;
  - `GET /desinscrire?jeton=` → page générée par le serveur avec un formulaire `POST` (aucune
    suppression) ; `POST /desinscrire?jeton=` → suppression, puis 303
    `/inscription/desinscrit/` (navigateur) ou 200 (corps `List-Unsubscribe=One-Click`) ;
  - au démarrage puis toutes les heures : `store.purgeExpired`.
- `Caddyfile` : CSP et en-têtes réécrits depuis `SECURITY_HEADERS` ; `checkSecurityHeaders`
  vérifie l'égalité exacte.

- [ ] **Step 1: tests (serveur sur port 0, base `startTestDatabase()`, boîte d'envoi temporaire)** —
  `every response carries the security headers`, `other hosts get 301 to the canonical origin`,
  `a valid subscription answers 303 merci and writes one message`, `a known confirmed address
  answers the same 303 and writes nothing`, `honeypot answers 303 merci and stores nothing`,
  `sixth request in ten minutes gets 429`, `cross-site POST is refused 403`, `oversized body is
  refused 413`, `GET /desinscrire never deletes`, `one-click POST deletes and answers 200`,
  `logs contain no @, no token and no address`, `Caddyfile equals SECURITY_HEADERS`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS ; commit `feat(server): Bun server for the site and the waitlist`.

### Task 14: Démo locale

**Files:**
- Create: `server/demo.ts`, `server/demo.test.ts`
- Modify: `package.json` (`"demo": "bun run check:bun:runtime && bun run build && bun server/demo.ts"`), `docs/build.md`

**Interfaces:**
- Produces: `startDemo(options: { port: number; siteDirectory: string; outboxDirectory: string }): Promise<{ url: string; stop(): Promise<void> }>`
  (PGlite + migrations + boîte d'envoi + `createServer`, hôte `localhost`).

- [ ] **Step 1:** test `demo serves the home page and accepts a subscription end to end` (fetch
  `/`, POST `/inscription`, lecture du `.eml`, GET du lien de confirmation → 303 confirmée).
- [ ] **Step 2:** FAIL. **Step 3:** implémenter ; documenter `bun run demo` (port 8080, boîte
  d'envoi `.demo/outbox`, ignorée par git). **Step 4:** PASS ; commit `feat(demo): local demo with embedded PostgreSQL and outbox`.

### Task 15: e2e, accessibilité, régression visuelle

**Files:**
- Modify: `playwright.config.ts` (`webServer.command`: `bun server/demo.ts --port 8080 --site dist --outbox .demo/outbox-e2e`),
  `e2e/website.e2e.ts` → `e2e/site.e2e.ts`, `e2e/motion.e2e.ts`
- Create: `e2e/waitlist.e2e.ts`, `e2e/visual.e2e.ts`, `e2e/__screenshots__/linux/**`

**Interfaces:** consomme `ROUTES` (Tâche 7) pour itérer sur chaque route.

- [ ] **Step 1: tests** —
  - sur chaque route et chaque projet (chromium, firefox, webkit, chromium-no-js) : `zero serious or
    critical axe violation`, `no horizontal scroll at 360, 390 and 1440 px`, `no console CSP
    violation`, `no request outside the local origin`, `exactly one h1` ;
  - `no-JS: home toggle, universe sections, tour list and waitlist form are usable` ;
  - `saved dark theme paints dark on first frame` ; `theme toggle is a pressed button with an
    accessible name` ; `tabs follow the ARIA pattern with arrow keys, Home and End` ;
  - `reduced motion: no running animation` ;
  - `waitlist: subscribe, confirm from the outbox link, unsubscribe in one click` ;
  - visuel (chromium, 390 et 1440 px, clair et sombre, animations désactivées) : `/`,
    `/applications/`, `/applications/sources/`, `/fabrique/` → `toHaveScreenshot`, gabarit
    `{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}`.
- [ ] **Step 2:** en local, navigateurs refusés par le sandbox : **unavailable** ; pousser la
  branche, ouvrir la PR, lire le run.
- [ ] **Step 3:** premier run : les captures `linux` manquent → échec attendu ; télécharger
  l'artefact `e2e-project-website-<tentative>`, relire chaque `*-actual.png`, les copier en
  références sous `e2e/__screenshots__/linux/`, commit `test(e2e): visual baselines from the first
  CI run`.
- [ ] **Step 4:** second run vert sur les quatre projets ; commit éventuel des correctifs.

### Task 16: Revue et intégration

- [ ] **Step 1:** `bun run check` → exit 0 ; compteurs relevés tels qu'imprimés.
- [ ] **Step 2:** `/code-review:code-review` sur la branche ; corriger ce qui est confirmé.
- [ ] **Step 3:** CI `composition / validate` verte sur la tête ; fusion squash + DCO par l'agent
  (règle durable : PR auto-écrite d'un dépôt PERSO du propriétaire, fusionnée sur vert) ; branche
  supprimée.
