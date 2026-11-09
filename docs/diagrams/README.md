# Diagrammes de la V1

Chaque diagramme est un fichier HTML unique, en SVG accessible, sans ressource distante.
Ils suivent le skill `diagram-design` (épinglé à `11b08ea`) ; leur source de texte est la
section du PRD indiquée ci-dessous.

| Fichier | Diagramme | Type | Source du texte |
| --- | --- | --- | --- |
| `d-03-decideur.html` | D-03, parcours décideur (sans branche d'état, ADR 0003) | flowchart | PRD §3.2, J2 |
| `d-04-contributeur.html` | D-04, parcours contributeur | process | PRD §3.2, J3 |
| `d-05-carte.html` | D-05, carte du site | tree | PRD §6 |

## Vérifier

```sh
python3 <dossier du skill>/scripts/self_check.py docs/diagrams/d-03-decideur.html
python3 <dossier du skill>/scripts/self_check.py docs/diagrams/d-04-contributeur.html
python3 <dossier du skill>/scripts/self_check.py docs/diagrams/d-05-carte.html
```

Résultat attendu : `OK <fichier>` pour chacun. Résultat vérifié le 2026-10-14 : les trois sont `OK`.

## DIAG-1 : texte du rendu = texte de la source

Chaque diagramme a une source de texte versionnée, `<nom>.nodes.txt` (une ligne par nœud).
`src/diagram-nodes.test.ts` échoue si un nœud du SVG n'est pas dans la source, si une ligne de la
source n'est pas rendue, ou si un diagramme n'a aucun nœud texte. Le test imprime ses compteurs.
Tout nouveau `.html` de ce dossier exige son `.nodes.txt`.

## Non fait

- DIAG-3 (détecteur, sortie `[]`) : rejouable par `bun run detect "$(mktemp -d)" dist docs/diagrams`
  (voir `docs/build.md`) ; 0 trouvaille relevée le 2026-10-15.
- D-06 (blueprint des preuves) est différé, comme dans le PRD.
