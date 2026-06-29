# Contribuer à VoltBot

Merci de ton intérêt ! Voici comment contribuer proprement.

## Mise en place

```bash
git clone https://github.com/ybenyedder/VoltBot.git
cd VoltBot
npm install
cp .env.example bots/instances/dev/.env   # remplis tes propres valeurs
```

## Avant de pousser

Lance toujours la vérification locale :

```bash
npm run lint    # vérification syntaxique
npm test        # tests Vitest
```

La CI GitHub Actions rejoue ces étapes + le build du dashboard sur chaque Pull Request.

## Règles

- **Ne committe jamais de secret.** Les `.env`, bases `*.db`, locks et logs sont ignorés par `.gitignore` — garde-les hors des commits. Utilise `.env.example` comme modèle.
- Une PR = une intention claire. Décris le quoi et le pourquoi.
- Respecte le style du code existant (mêmes conventions de nommage, indentation, structure des dossiers `core/commands/<catégorie>`).
- Ajoute/maintiens des tests quand tu touches à une logique testée (`tests/`).

## Convention de commits

Format conseillé : `type: résumé court`

| Type | Usage |
|------|-------|
| `feat` | nouvelle fonctionnalité |
| `fix` | correction de bug |
| `docs` | documentation |
| `refactor` | refactoring sans changement de comportement |
| `test` | ajout/maj de tests |
| `chore` | maintenance, config, dépendances |

## Signaler un bug / proposer une idée

Ouvre une [issue](https://github.com/ybenyedder/VoltBot/issues) en utilisant les modèles fournis.
