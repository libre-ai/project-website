# Diagrammes de la V1

Chaque diagramme est un fichier HTML unique, en SVG accessible, sans ressource distante.
Ils suivent le skill `diagram-design` (épinglé à `11b08ea`) ; leur source de texte est la
section du PRD indiquée ci-dessous.

| Fichier | Diagramme | Type | Source du texte |
| --- | --- | --- | --- |
| `d-03-decideur.html` | D-03, parcours décideur | flowchart | PRD §3.2, J2 |
| `d-04-contributeur.html` | D-04, parcours contributeur | process | PRD §3.2, J3 |
| `d-05-carte.html` | D-05, carte du site | tree | PRD §6 |

## Vérifier

```sh
python3 <dossier du skill>/scripts/self_check.py docs/diagrams/d-03-decideur.html
python3 <dossier du skill>/scripts/self_check.py docs/diagrams/d-04-contributeur.html
python3 <dossier du skill>/scripts/self_check.py docs/diagrams/d-05-carte.html
```

Résultat attendu : `OK <fichier>` pour chacun. Résultat vérifié le 2026-10-14 : les trois sont `OK`.

## Non fait

- Le détecteur Impeccable (DIAG-3, sortie `[]`, exit 0) n'a pas été lancé : il faut compiler ou
  télécharger son binaire, ce qui n'est pas encore autorisé.
- DIAG-1 (chaque nœud du rendu existe dans la source) n'est pas automatisé : vérifié à la main.
- D-06 (blueprint des preuves) est différé, comme dans le PRD.
