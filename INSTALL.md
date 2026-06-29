# Installation du bot

> Ce zip contient déjà tes fichiers `.env` (tokens Discord) et les bases de données.
> **Garde-le privé** — ne le partage avec personne.
> `node_modules` n'est PAS inclus (trop lourd) → tu le réinstalles avec `npm install`.

Prérequis : **Node.js 18+**.

---

## Option A — Faire tourner sur ton téléphone (Android, Termux)

1. Installe **Termux** depuis **F-Droid** (PAS le Play Store, version obsolète) : https://f-droid.org/packages/com.termux/
2. Ouvre Termux et installe les outils (better-sqlite3 et canvas se compilent → besoin des build-tools) :
   ```bash
   pkg update && pkg upgrade -y
   pkg install -y nodejs git unzip python make clang pkg-config
   ```
3. Copie le zip dans Termux puis décompresse :
   ```bash
   termux-setup-storage          # autorise l'accès au stockage (1x)
   cd ~
   unzip /sdcard/Download/bot.zip -d bot
   cd bot
   ```
4. Installe + lance (script tout-en-un) :
   ```bash
   bash install.sh
   npm start
   ```

Si `better-sqlite3` ou `@napi-rs/canvas` refusent de compiler sur Termux (modules natifs),
utilise l'**Option B** (hébergement) — c'est plus simple depuis un téléphone.

---

## Option B — Héberger (recommandé depuis un téléphone)

Plus fiable que Termux pour les modules natifs. Depuis le navigateur du tél :

- **Pterodactyl / panel Discord-bot** : crée un serveur Node.js, upload le zip, décompresse, démarre `node start.js`.
- **Railway / Render / Replit** : nouveau projet → upload/import le zip → commande de démarrage `npm start`.

Dans tous les cas : commande d'install `npm install`, build dashboard `npm run build:dashboard`, démarrage `npm start`.

---

## Manuel (si tu ne veux pas `install.sh`)

```bash
npm install                 # dépendances du bot
npm run build:dashboard     # build l'interface web (dashboard-client)
npm start                   # démarre l'orchestrateur (lit bots/instances/*/.env)
```

- Le bot lit chaque instance dans `bots/instances/<nom>/.env` (token déjà rempli).
- Le dashboard tourne sur le `PORT` défini dans le `.env`.
- Langue serveur : `+setlang en` / `+setlang fr`. Langue dashboard : sélecteur dans l'UI.

## Dépannage
- `better-sqlite3` erreur de build → `pkg install python make clang` (Termux) ou `apt install build-essential python3` (Linux), puis `npm rebuild better-sqlite3`.
- Dashboard ne charge pas → relance `npm run build:dashboard`.
- Bot ne démarre pas → vérifie les variables requises dans le `.env` (voir `.env.example`).
