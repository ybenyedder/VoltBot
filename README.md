# VoltBot

[![CI](https://github.com/ybenyedder/VoltBot/actions/workflows/ci.yml/badge.svg)](https://github.com/ybenyedder/VoltBot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)

Plateforme **multi-bots Discord** centralisée avec un **dashboard web**. Un seul orchestrateur (`start.js`) fait tourner plusieurs instances de bot, chacune avec sa propre configuration, sa base de données et son interface d'administration.

## ✨ Fonctionnalités

Le cœur (`core/commands`) regroupe un large éventail de modules :

| Catégorie | Modules |
|-----------|---------|
| Modération | `moderation`, `antiraid`, `security`, `logs` |
| Communauté | `levels`, `economy`, `social`, `birthdays`, `invitations` |
| Serveur | `roles`, `tickets`, `suggestions`, `voice`, `stats` |
| Outils | `utility`, `fun`, `custom`, `config`, `backup` |

- **Dashboard web** (React/Vite) avec login OAuth2 Discord
- **Multi-langues** (serveur : `+setlang fr` / `+setlang en` ; dashboard : sélecteur dans l'UI)
- **Base SQLite par instance** (`better-sqlite3`)
- Génération d'images (`@napi-rs/canvas`), transcripts de tickets, anti-raid, etc.

## 🏗️ Architecture

```
.
├── start.js              # Orchestrateur : lit bots/instances/*/.env et lance chaque bot
├── core/
│   ├── commands/         # Commandes regroupées par catégorie
│   ├── events/           # Handlers d'événements et d'interactions
│   ├── dashboard/        # API backend (Express) du dashboard
│   ├── locales/          # Fichiers de traduction
│   ├── config/           # Configuration partagée
│   └── utils/            # Utilitaires
├── dashboard-client/     # Front-end du dashboard (Vite)
├── bots/instances/       # Une instance par bot : <nom>/.env + data/bot.db
└── tests/                # Tests Vitest
```

Chaque bot vit dans `bots/instances/<nom>/` :
- `.env` — configuration de l'instance (token, OAuth2, port…) — **non versionné**
- `data/bot.db` — base SQLite de l'instance — **non versionnée**

## 🚀 Démarrage rapide

Prérequis : **Node.js 18+**.

```bash
npm install                 # dépendances du bot
npm run build:dashboard     # build de l'interface web
npm start                   # démarre l'orchestrateur
```

### Configuration

Aucun secret n'est versionné. Pour chaque instance, crée `bots/instances/<nom>/.env` à partir du modèle :

```bash
cp .env.example bots/instances/mon-bot/.env
# puis remplis DISCORD_TOKEN, DISCORD_CLIENT_ID/SECRET, JWT_SECRET, etc.
```

Variables principales (voir [`.env.example`](.env.example)) :

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Token du bot Discord (**requis**) |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth2 pour le login dashboard |
| `DISCORD_REDIRECT_URI` | URL de callback OAuth2 |
| `JWT_SECRET` | Secret aléatoire pour les sessions dashboard |
| `PORT` | Port du dashboard de l'instance |
| `OWNER_ID` | ID(s) Discord owner (bypass total) |

Le front-end (`dashboard-client/.env`) utilise `VITE_DISCORD_CLIENT_ID` et `VITE_API_URL` (voir `dashboard-client/.env.example`).

> 📄 Détails d'installation (Termux, hébergement Pterodactyl/Railway/Render…) : voir [`INSTALL.md`](INSTALL.md).

## 🛠️ Scripts npm

| Script | Action |
|--------|--------|
| `npm start` | Démarre l'orchestrateur multi-bots |
| `npm run dev` | Démarrage en mode développement |
| `npm test` | Lance les tests (Vitest) |
| `npm run lint` | Vérification syntaxique des fichiers JS |
| `npm run build:dashboard` | Build du dashboard |
| `npm run verify` | `lint` + `build:dashboard` |
| `npm run clean` | Nettoie les builds et vieux snapshots |

## 🔒 Sécurité

Les fichiers sensibles ne sont **jamais** versionnés (voir [`.gitignore`](.gitignore)) : `.env`, bases `*.db`, locks et logs. Ne committe jamais de token réel — utilise toujours les fichiers `.env.example` comme modèle.

## 📦 Stack

Node.js · discord.js v14 · Express 5 · better-sqlite3 · React/Vite · JWT · Vitest
