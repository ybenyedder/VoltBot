# 🔍 VoltBot — Rapport d'audit technique complet

> Audit réalisé le 14/09/2026 sur l'intégralité du code source en **deux vagues** (6 audits parallèles puis 5 agents de durcissement, + 4 agents correctifs entre les deux — 15 agents au total).
> Les correctifs marqués ✅ ont été appliqués dans cette copie locale.

---

## Résumé exécutif

| Zone | Fichiers | État |
|---|---|---|
| Commandes | 312 fichiers, 19 catégories | Inventaire complet → [HELP.md](HELP.md) |
| Events + handlers | 31 fichiers, ~8 070 lignes | 9 bugs + 8 durcissements ✅ |
| Utils + base SQLite | 22 fichiers, 35 tables | 7 bugs + chiffrement vanity ✅ |
| Dashboard backend | 13 fichiers, ~97 routes | 6 failles + auth durcie ✅ |
| Dashboard frontend | SPA React | 8 bugs + code-splitting (-67 %) ✅ |
| Racine / tooling | scripts, tests, CI, docs | Tokens retirés, tests 76/76, ESLint + gitleaks en CI ✅ |

**Validation finale** : 76/76 tests passent (100 % hors-ligne) · `npm run lint` vert (0 erreur) · build dashboard OK.

**Points forts du code** : SQL 100 % paramétré (better-sqlite3 prepared statements partout), pragmas SQLite exemplaires (WAL, busy_timeout, FK), transactions économiques atomiques déjà en place, i18n fr/en parfaitement symétrique (5 038 clés), cookies JWT httpOnly, DOMPurify sur le HTML, focus traps et a11y soignés côté dashboard.

---

## 🔴 SÉCURITÉ — corrigé dans cette copie

### S1. Tokens Discord en dur dans 4 scripts (CORRIGÉ ✅)
`migrate_config.js`, `migrate_newbot.js`, `clone_server.js` et `get_guild.js` contenaient les **tokens réels des 3 bots** (voltbot, nocoin, newbot) en clair. Ces fichiers n'étaient pas ignorés par git et le repo a un remote GitHub public.

- **Correctif appliqué** : les tokens sont désormais chargés depuis `bots/instances/<nom>/.env` (fichiers ignorés par git) via un helper `loadInstanceToken()`.
- **⚠️ Action requise de ta part** : par précaution, **régénère les tokens des 3 bots** dans le [Discord Developer Portal](https://discord.com/developers/applications) — ils ont circulé en clair dans plusieurs fichiers et backups.

### S2. PAT GitHub incrusté dans .git/config (CORRIGÉ ✅)
L'URL du remote origin contenait un Personal Access Token (`https://ghp_...@github.com/...`). Remplacée par l'URL propre. **Régénère aussi ce PAT** sur GitHub.

### S3. Copies de .env dans les backups (CORRIGÉ ✅)
`backups_lettres_fix_20260911/env_backup` et `env_newbot_backup` contenaient des copies complètes des `.env` (tokens, JWT_SECRET, client secret). Supprimés, et `backups_*/` ajouté au `.gitignore`.

### S4. .gitignore étendu (CORRIGÉ ✅)
Ajout de `backups_*/`, `migrate_*.js`, `clone_server.js`, `get_guild.js`, `voltbot_setup.js` pour éviter tout commit accidentel de fichiers sensibles.

### S5. Bypass des rate-limits du dashboard (CORRIGÉ ✅)
`app.set("trust proxy", 1)` + écoute sur `0.0.0.0` permettait de spoofer `X-Forwarded-For` et de brute-forcer la phrase secrète (`POST /api/auth/phrase` → accès owner total). Correctifs : trust proxy conditionnel (`TRUST_PROXY` env), `keyGenerator` du loginLimiter basé sur `req.socket.remoteAddress`, hash du préfixe de phrase dans les logs d'accès (au lieu des 10 premiers caractères du secret).

### S6. /api/status public (CORRIGÉ ✅)
Exposait `authenticated_user` (ID + pseudo Discord) et `bot_settings` sans authentification → désormais sous `requireAuth`.

### S7. Restauration de backup insuffisamment protégée (CORRIGÉ ✅)
`POST /api/guilds/:guildId/backups/:id/restore` supprime **tous les salons et rôles** du serveur — désormais couvert par le `destructiveLimiter` (10 req/15 min).

### S8. Token utilisateur Discord stocké en clair (⚠️ À traiter)
`core/utils/database.js` — la table `vanity_snipers` stocke un **user token Discord** en clair (`userToken TEXT`). Toute compromisation de la DB = compromission du compte. Recommandation : chiffrer (AES-256-GCM avec clé dérivée d'un secret env). À noter : le vanity-sniping par user token est une **violation des ToS Discord** (auto-botting) pouvant mener au ban du compte et du bot.

---

## 🐛 BUGS MAJEURS — corrigés

### B1. Starboard entièrement mort (CORRIGÉ ✅)
Des emojis avaient été corrompus en **chaînes vides** à un encodage : `if (reaction.emoji.name !== "") return;` dans `messageReactionAdd.js` retournait toujours → le starboard ne se déclenchait **jamais**. Même corruption dans `messageReactionRemove.js` et dans `core/events/config/config.js` (emojis `success`, `error`, `coin`, `level` vides → tous les messages d'économie s'affichaient sans icône). Emojis restaurés.

### B2. Panel admin des tickets inutilisable (CORRIGÉ ✅)
5 appels `permissions.isAdmin({ author, member }, client)` sans `guild` dans `captchaTicketHandlers.js` → TypeError pour tout non-bot-owner : les admins de serveur ne pouvaient pas gérer les options de tickets. Remplacés par `interaction.memberPermissions.has(PermissionFlagsBits.Administrator)` + ack des interactions.

### B3. Seuil anti-nuke ignoré (CORRIGÉ ✅)
`channelDelete.js` / `roleDelete.js` : `isNuke` était calculé mais jamais lu → la sanction tombait dès la 1re suppression, ignorant `nukeChannelLimit`. Désormais : `if (config.antiChannel === 2 || isNuke)`. Bonus : les overwrites du salon recréé sont lus dans `auditLog.old` (au lieu de `.new` toujours absent) → le salon recréé **conserve ses permissions**.

### B4. `getUser(field)` corrompait les soldes (CORRIGÉ ✅)
`database.js` : `if (field && user[field])` retournait la **ligne entière** quand la valeur valait `0` → `coins + 100` donnait `"[object Object]100"`. Corrigé sur le pattern de `getGuild`.

### B5. Double-claim `+daily` / `+work` (CORRIGÉ ✅)
Get-check-set non atomique → deux `+daily` simultanés doublaient la récompense. Ajout de `tryClaimDaily` / `tryClaimWork` (UPDATE conditionnel atomique, pattern de `tryRemoveCoins`).

### B6. Inventaire sans contrainte UNIQUE (CORRIGÉ ✅)
Deux items identiques pouvaient créer des lignes dupliquées. Migration : fusion des doublons existants + index unique + upsert `ON CONFLICT` dans `addItem`.

### B7. Logout factif (CORRIGÉ ✅)
Le bouton "Déconnexion" du dashboard ne faisait qu'une redirection — le cookie JWT restait valide 24 h (retour en arrière = dashboard accessible). Route `POST /api/auth/logout` créée + appelée côté frontend.

### B8. Écran blanc sur URL inconnue (CORRIGÉ ✅)
Aucune route 404 dans le router React → page vide. Route `path="*"` ajoutée.

### B9. Promesses flottantes (CORRIGÉ ✅)
~12 `channel.send()` / `.then()` sans `.catch` (level-ups, logs vocaux, messages d'automod) → unhandledRejections. `.catch` ajoutés + **wrapper global** à l'enregistrement des events dans `core/index.js` : une erreur dans un handler est désormais loggée avec son origine au lieu de remonter en crash.

### B10. Regex anti-link divergentes (CORRIGÉ ✅)
`messageUpdate.js` utilisait une regex plus permissive que `automodHandler.js` → **contournement de l'anti-link en éditant un message**. Regex unifiée dans `core/events/handlers/linkRegex.js`.

### B11. Warn antiraid fantôme (CORRIGÉ ✅)
La punition "warn" de l'antiraid annonçait la sanction dans le log sans jamais l'écrire en DB (invisible dans `+warnings`, sans effet cumulatif). Désormais enregistrée via `addWarning` avec préfixe `[ANTIRAID]`.

### B12. Frontend : polling 403 silencieux + double fetch (CORRIGÉ ✅)
Le polling `/bot/logs` toutes les 3 s tournait pour tous les utilisateurs (403 pour les non-owners → ~300 req/15 min, risque de 429). Gated sur `isGlobalOwner`. Le double fetch de ~18 requêtes au montage pour les global owners éliminé (refs au lieu des dépendances d'useEffect).

### B13. Divers frontend (CORRIGÉ ✅)
Redirection 401 sans `return` (la réponse continuait d'être consommée), uptime "99.9 %" hardcoded, `onClick` async sans try/catch sur `/bot/logs/full`, proxy Vite manquant (`/api` 404 en dev), `index.html` (`lang`, titre "Vite + React"), clés de stockage incohérentes Login/api, versions incohérentes.

### B14. Scripts root (CORRIGÉ ✅)
`migrate_config.js` et `migrate_newbot.js` étaient des copies identiques à 3 lignes près (542 lignes dupliquées) — fusion recommandée mais conservés séparéments, dé-tokenisés.

---

## 🟡 AMÉLIORATIONS APPLIQUÉES AU PASSAGE

- Fisher-Yates dans `giveaways.js` (l'ancien `sort(() => Math.random() - 0.5)` était biaisé → tirage de gagnants non uniforme).
- Validation des montants dans `addCoins`/`setCoins`/`setBank` (plus de soldes négatifs possibles).
- Filtre anti-injection SQL sur les clés de `updateVanitySniper` (comme les autres update*).
- `lucky_charm` désormais **consommé** quand son effet se déclenche (roulette/slots) — c'était un buff permanent achetable une fois.
- Invalidation du cache de modules sur `guildDelete` (fuite mémoire multi-guildes).
- Fallback "ZeroDay" → "VoltBot" dans `embedBuilder.js`.
- Garde-fou dans `interactionCreate.js` pour les slash commands éventuelles (réponse éphémère au lieu d'un échec silencieux).
- Null-checks audit log dans `guildMemberUpdate.js` (section anti-rank hors try → TypeError possible).

---

## 🌊 VAGUE 2 — durcissement approfondi (5 agents supplémentaires)

### Appliqué

- **Token vanity chiffré au repos (AES-256-GCM)** ✅ — `database.js` : clé dérivée scrypt de `VANITY_TOKEN_KEY`/`JWT_SECRET`, format `enc:v1:…`, déchiffrement transparent, compatibilité legacy plaintext. Backoff réseau global (5 s → 5 min) sur le sniper, purge de `lastAlertTimestamps`, plus de mention `@everyone` involontaire.
- **Phrases secrètes hashées (scrypt + timingSafeEqual)** ✅ — migration transparente des phrases existantes (re-hash au premier login validé), master env en comparaison timing-safe, `GET /speedphrases` n'expose plus ni phrase ni hash (métadonnées masquées uniquement).
- **OAuth Discord réparé** ✅ — paramètre `state` anti-CSRF (cookie httpOnly à usage unique), access token Discord désormais persisté en cookie httpOnly (la branche OAuth de `/user/guilds` fonctionne), allow-list stricte des hosts pour le `redirect_uri`, limiter dédié sur `/login` + `/callback`. Bug B-2 corrigé : plus de cache périmé servi après expiration (401 clair).
- **Orchestrateur durci** ✅ — backoff exponentiel (5 s → 5 min) + abandon d'une instance après 8 crashs consécutifs (sans tuer les autres), refus du port 3000 pour une instance, `.bot.lock` supprimé uniquement s'il appartient au child mort, rate-limit global sur le gateway.
- **Gate antiraid centralisée** ✅ — `processSanction` vérifie `isModuleEnabled("antiraid")` (+ les 4 events qui faisaient des reverts avant sanction) : désactiver le module coupe désormais TOUTES les protections.
- **Whitelist granulaire réparée** ✅ — clés réelles par module (`antiBan`, `antiUnban`, `antiKick`, `antiWebhook`, `antiRank`) + retombée sur la whitelist globale quand l'entrée granulaire ne couvre pas le module.
- **Captcha cryptographique** ✅ — `crypto.randomInt` sur alphabet sans ambiguïté (0/O/1/l/I retirés).
- **Voicemaster throttlé** ✅ (5 s, modèle TempVC) — plus de spam de création de salons.
- **Honeypot optimisé** ✅ — purge ciblée sur le salon honeypot uniquement (au lieu de fetcher tous les salons), i18n complet (`events.honeypot.*`).
- **Blacklist avant XP/drops** ✅ — un utilisateur blacklisté ne gagne plus XP/coins.
- **Lettres anonymes** ✅ — `crypto.randomUUID()` au lieu de `Math.random()`.
- **Logger persistant** ✅ — `logs/bot-YYYY-MM-DD.log` par instance (rotation quotidienne, purge 7 j, tolérance aux erreurs FS, console inchangée). Bonus : récursion infinie préexistante de `Logger.log()` corrigée.
- **Code-splitting frontend** ✅ — React.lazy + Suspense : bundle d'entrée 932 Ko → **303 Ko (-67 %)**, GuildDashboard/Dashboard/Doc en chunks séparés.
- **Dashboard.jsx restructuré** ✅ — sous-composants (Header, GuildCard…) remontés hors du corps du composant (fini les re-créations à chaque render).
- **i18n frontend complété** ✅ — ErrorBoundary (avec accents corrigés), Login, Dashboard, Doc migrés vers les locales (+26 clés fr/en symétriques, 521/521).
- **Tests fiabilisés et étendus** ✅ — réseau mocké (`vanitySniper`, `animeGif` : 100 % hors-ligne, 1,1 s → 0,5 s), nouveaux tests : linkRegex (11), database étendu (17 : getUser falsy, claims atomiques, upsert, clamps), giveaways/Fisher-Yates (8). **76 tests au total, 76 passent.**
- **ESLint branché** ✅ — `npm run lint` = `node --check` (384 fichiers) + `eslint core/ start.js` (0 erreur, 152 avertissements cosmétiques).
- **CI renforcée** ✅ — matrix Node 18/20, job **gitleaks** (détection de secrets — aurait attrapé les tokens de la vague 1), `npm audit` informatif.
- **Collisions d'alias nettoyées** ✅ — `config`, `setbday`, `clean`, `clear`, `nuke`, `serverstats`, `fermer`, `close`, `pp` : chaque alias pointe désormais vers une seule commande.
- **clone_server.js sécurisé** ✅ — confirmation `--yes` obligatoire avant la purge destructive du serveur destination.
- **INSTALL.md réconcilié** ✅ avec CONTRIBUTING.md (clone public vs zip privé), PORT 3001+ documenté.

### Décisions argumentées

- **Clés i18n dites "orphelines" : NON purgées.** L'audit initial les croyait inutilisées, mais la commande `+help` les lit dynamiquement (`commands.<name>.description`/`usage` via `descOf()`/`usageOf()`) — les purger casserait l'aide intégrée.
- **Doublons fonctionnels conservés** (`clear`/`purge`, `server`/`serverinfo`, `help`/`onepage`, etc.) : les fusionner changerait le comportement vu des utilisateurs ; ils sont documentés dans HELP.md à la place.

---

## 📋 RECOMMANDATIONS NON APPLIQUÉES (restantes)

### Priorité moyenne
1. **35 routes dashboard mortes** (boutique, backups, custom-commands, suggestions, invites, captcha, fivem, mute-presets, bot/control, system/errors) : surface d'attaque sans UI — supprimer ou brancher.
2. **GuildDashboard.jsx : 5 488 lignes** — le code-splitting est fait, mais le découpage en composants par onglet reste à faire (50 useState dans un seul composant).
3. **152 avertissements ESLint** (vars inutilisées, etc.) — cosmétiques, à éliminer progressivement.
4. **Pattern audit-log dupliqué dans 15 fichiers d'events** (~500 lignes) → factoriser dans `core/utils/auditLogs.js`.
5. **Distorsion d'image du captcha** (le code est désormais crypto-safe mais toujours lisible par OCR).
6. **Fusionner `migrate_config.js`/`migrate_newbot.js`** en un script paramétré unique.
7. **Badwords par homoglyphes** (caractères cyrilliques lookalikes) — translittération Unicode optionnelle.
8. **`addCoins`/`removeCoins` sur utilisateur inexistant** : no-op silencieux (UPDATE 0 ligne) — créer la ligne automatiquement serait plus robuste.

---

## 🚀 Déploiement des correctifs vers le serveur

Cette copie est locale (`/home/cvsbd/Téléchargements/VoltBot`). Pour pousser les correctifs sur le serveur :

```bash
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='bots/instances' --exclude='data' \
  /home/cvsbd/Téléchargements/VoltBot/ volt@192.168.1.87:VoltBot/
```

Puis sur le serveur : redémarrer les bots (`pm2 restart` ou relancer `node start.js`). ⚠️ La migration SQLite (index unique inventaire) s'exécutera automatiquement au démarrage — **fais un backup des DB avant** (`+dbbackup` ou copie des fichiers `bots/instances/*/data/bot.db`).
