# Références de marque : usage et conditions

Les fichiers ci-dessous appartiennent à l'instantané legacy `design-system-c8fb246`, hors de ce
dépôt. Ils ne sont pas copiés ici, sauf `identity/libre-ia-icon-dark.svg` : ADR 0004 en a repris le
martinet, et le fichier est versionné dans `src/brand/source/`, où `src/brand/martinet-paths.test.ts`
compare les tracés du code à leur source (I-39, `project-governance`). Les autres servent de
références pour une vague ultérieure ; aucun n'entre dans le site V1 (voir ADR 0002).

| Ressource | Ce qu'elle contient | Condition d'usage dans le site |
| --- | --- | --- |
| `identity/*.svg` | Oiseau, logotypes clair et sombre | Interdit tant que le signe n'est pas publié (licence et similarité) |
| `contact-sheets/system-overview.png` | Planche de l'identité legacy | Référence uniquement |
| `illustrations` (planche 10) | Scènes développeur, infrastructure, audit | Interdit tant que l'identité visuelle n'est pas décidée |
| `motion/core/*.svg` | Animations de logo, cube, réseau | Interdit : animation de logo exclue par la doctrine |
| `motion/mascot/*.svg` | Mascotte | Interdit : pas de mascotte dans la doctrine |
| `metaphors/*.svg` | Hero et métaphores (globe, cubes, réseaux) | Interdit : décors exclus par la doctrine |

## Conditions de réouverture

1. Le signe « Portique d'atelier » a sa licence dédiée et son contrôle de similarité archivé.
2. Une décision écrite (ADR) acte quelles références entrent, et sous quelle forme.
3. Chaque élément réintroduit passe les contrôles existants : G7 (tokens), axe, FR-07 (lecture
   sans JavaScript).
