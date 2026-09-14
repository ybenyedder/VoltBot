# 📖 VoltBot — Documentation complète des commandes

> **312 commandes** réparties en **19 catégories**, sur 3 instances de bot (voltbot, nocoin, newbot).

VoltBot est un système de **commandes à préfixe** (pas des slash commands). Le préfixe par défaut est `+` et se change avec `+setprefix`. La commande d'aide intégrée est `+help` ( Administrateur) — elle est 100 % dynamique et liste les commandes selon vos droits.

- `+help` → menu interactif par catégorie (sélecteur, recherche, pagination)
- `+help <commande>` → détail d'une commande (usage, aliases, permissions)
- `+onepage` → toutes les commandes sur une seule page
- `+helptest` → liste complète sans filtrage (Bot Owner uniquement)

---

## Sommaire

| Catégorie | Nb | Rôle |
|---|---|---|
| [🛡️ Admin](#-admin) | 13 | Administration globale du bot |
| [🚨 Antiraid](#-antiraid) | 30 | Protections automatiques du serveur |
| [💾 Backup](#-backup) | 1 | Sauvegarde/restauration du serveur |
| [🎂 Birthdays](#-birthdays) | 2 | Anniversaires |
| [⚙️ Config](#-config) | 33 | Configuration du serveur |
| [✏️ Custom](#-custom) | 3 | Commandes personnalisées |
| [💰 Économie](#-économie) | 23 | Économie, casino, boutique |
| [🎮 Fun](#-fun) | 16 | Jeux et divertissement |
| [📨 Invitations](#-invitations) | 7 | Suivi des invitations |
| [📈 Niveaux](#-niveaux) | 7 | Système d'XP et de niveaux |
| [🔨 Modération](#-modération) | 53 | Sanctions et gestion des membres |
| [🎭 Rôles](#-rôles) | 8 | Gestion des rôles |
| [🔐 Sécurité](#-sécurité) | 1 | Vérification captcha |
| [💗 Social](#-social) | 6 | Interactions sociales |
| [📊 Stats](#-stats) | 4 | Statistiques |
| [💡 Suggestions](#-suggestions) | 3 | Suggestions de la communauté |
| [🎫 Tickets](#-tickets) | 8 | Support par tickets |
| [🧰 Utilitaires](#-utilitaires) | 73 | Outils divers |
| [🎙️ Vocal](#-vocal) | 21 | Salons vocaux privés |

**Légende restrictions** : `Owner` = Bot Owner (accès global) · `Admin` = permission Discord Administrateur · autre permission Discord sinon. Absent = commande publique.

---

## 🛡️ Admin

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `bl` | Blackliste un utilisateur du bot. Il ne pourra plus exécuter aucune commande. | `bl <@user/id> [raison]` | Owner |
| `botactivity` | Change l'activité du bot (playing, watching, listening). | `botactivity <playing/watching/listening> <texte...>` | Owner |
| `botnick` | Change le pseudo du bot sur ce serveur. | `botnick <nom>` | Owner |
| `botstatus` | Gère le statut (online, dnd...) et l'activité personnalisée de façon indépendante. | `botstatus <online/idle/dnd/invisible>` ou `custom <Texte>` | Owner |
| `dbbackup` | Crée un snapshot atomique de la base SQLite via db.backup(). Garde les 7 plus récents. | `dbbackup` | Owner |
| `dbrestore` | Liste les snapshots DB ou restaure depuis un id. Restauration : arrête le bot, swap au prochain démarrage. | `dbrestore [snapshot-id]` | Owner |
| `honeypot` | Crée un salon piège à raid (honeypot). | `honeypot [create / set #channel / off]` | Admin |
| `muteconfig` | Configure les préréglages de mute (durée + raison). Le staff les utilisera comme presets. | `muteconfig [list / on / off / add <nom> <durée> <raison> / del <nom>]` | Owner |
| `owner` | Gère les Bot Owners (accès global au bot). | `owner add @user / remove @user / list` | Owner |
| `servers` | Affiche la liste de tous les serveurs où le bot est présent. | `servers` | Owner |
| `setavatar` | Change la photo de profil du bot. | `setavatar [lien/image jointe]` | Owner |
| `setbotbanner` | Change la bannière du bot (nécessite un bot vérifié). | `setbotbanner [lien/image jointe]` | Owner |
| `unbl` | Retire un utilisateur de la blacklist du bot. | `unbl <@user/id>` | Owner |

## 🚨 Antiraid

Toutes les protections acceptent `[on/off/max]` : `on` = sanctions actives, `off` = désactivé, `max` = mode maximum (sanction immédiate + seuils nuke serrés). Les membres whitelists/bypass sont épargnés.

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `antiban` | Protection contre les bans massifs. | `antiban [on/off/max]` | Admin |
| `antibot` | Protection contre l'ajout de bots non autorisé. | `antibot [on/off/max]` | Admin |
| `antichannel` | Protection contre la création/suppression massive de salons. | `antichannel [on/off/max]` | Admin |
| `anticreateinvite` | Protection anti-création d'invitations. | `anticreateinvite [on/off/max]` | Admin |
| `antieditguild` | Protection anti-modification du serveur. | `antieditguild [on/off/max]` | Admin |
| `antiemote` | Protection contre la modification massive d'emojis. | `antiemote [on/off/max]` | Admin |
| `antieveryone` | Protection anti-@everyone/@here. | `antieveryone [on/off/max]` | Admin |
| `antigif` | Bloque l'envoi de GIFs. | `antigif [on/off/max]` | Admin |
| `antijoin` | Protection contre les raids d'arrivées massives. | `antijoin [on/off/max]` | Admin |
| `antilink` | Protection contre les liens (invites Discord ou tous liens). | `antilink <on/off/max> / ignore <on/off/list/clear> [#salons] / only <#salons/off> / sanction <on/off> / type <invites/all>` | Admin |
| `antimassmention` | Protection contre les mentions de masse. | `antimassmention [on/off/max]` | Admin |
| `antinewaccount` | Bloque les comptes trop récents. | `antinewaccount [on/off/max]` | Admin |
| `antirank` | Empêche l'attribution de rôles non autorisée. | `antirank <on/off/max> / type <danger/all>` | Admin |
| `antirole` | Protection contre la création/suppression massive de rôles. | `antirole [on/off/max]` | Admin |
| `antisoundboard` | Bloque l'utilisation du soundboard. | `antisoundboard [on/off/max]` | Admin |
| `antispam` | Protection contre le spam de messages. | `antispam <on/off/max> / gestion` | Admin |
| `antisticker` | Bloque l'envoi de stickers. | `antisticker [on/off/max]` | Admin |
| `antithread` | Bloque la création de threads. | `antithread [on/off/max]` | Admin |
| `antiunban` | Protection contre les débans non autorisés. | `antiunban [on/off/max]` | Admin |
| `antiwebhook` | Protection contre les webhooks. | `antiwebhook [on/off/max]` | Admin |
| `automod` | Configure le mode automatique de modération. | `automod enable/disable/action <...>` | Admin |
| `blrank` | Classement des membres blacklist. | `blrank` | Admin |
| `bypass` | Ajoute/supprime un utilisateur du bypass antiraid. | `bypass <add/remove/list> @user` | Admin |
| `captcha` | Configure le système de captcha. | `captcha enable/disable/role @role/channel #salon` | Admin |
| `clean` | Nettoie les messages suspects (raid/spam). | `clean [nombre]` | Admin |
| `creationlimit` | Définit une limite de création de contenu. | `creationlimit <type> <valeur>` | Admin |
| `module` | Active/désactive un module antiraid spécifique. | `module <nom> on/off` | Admin |
| `ndd` | Protection contre les noms de domaine (liens malveillants). | `ndd enable/disable/add/remove/list <domaine>` | Admin |
| `secur` | Affiche le niveau de sécurité du serveur. | `secur` | Admin |
| `whitelist` | Gère la whitelist des utilisateurs protégés. | `whitelist add/remove/list @user` | Admin |

## 💾 Backup

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `backup` | Gère les sauvegardes du serveur (créer, lister, restaurer). | `backup [create / load <id> / list / delete <id>]` | Admin |

## 🎂 Birthdays

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `birthdays` | Affiche les prochains anniversaires du serveur. | `birthdays` | — |
| `setbirthday` | Définit votre date d'anniversaire. | `setbirthday [JJ] [MM]` | — |

## ⚙️ Config

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `autoreact` | Ajoute des réactions automatiques aux messages d'un salon. | `autoreact <add/remove/list/clear> [#salon] [emoji1 emoji2 ...]` | Admin |
| `badword` | Gère la liste des mots interdits. | `badword add <mot> / remove <mot> / list / on / off` | Admin |
| `config` | Affiche la configuration actuelle du serveur. | `config` | Admin |
| `configmenu` | Menu de configuration complète du bot — affiche et gère tous les paramètres du serveur. | `configmenu` | Admin |
| `dropchannel` | Configure les salons où les coffres (drops) peuvent apparaître. | `dropchannel <add/remove/list/all> [salon]` | Admin |
| `drops` | Active ou désactive les coffres (drops) aléatoires. | `drops <on/off/toggle/status>` | Admin |
| `fivem` | Lien avec un serveur FiveM/RedM. | `fivem <IP:Port / off>` | Admin |
| `lockall` | Verrouille CHAQUE salon texte du serveur en cas de raid. | `lockall` | Admin |
| `public` | Restreint les commandes publiques à certains salons. | `public <allow/deny/list> [salon]` | Admin |
| `roleperm` | Configure les commandes autorisées pour un rôle via un menu interactif. | `roleperm @role` | Admin |
| `serverstats` | Crée une catégorie Statistiques avec des compteurs en temps réel. | `serverstats [invite code]` | Admin |
| `setautorole` | Définit un rôle donné automatiquement à chaque nouveau membre. | `setautorole [@Role]` | Admin |
| `setavis` | Définit le salon où les avis (+avis) seront envoyés. | `setavis [#salon]` | Admin |
| `setbanner` | Définit la bannière du serveur. | `setbanner [lien ou image jointe]` | ManageGuild |
| `setbirthdaychannel` | Définit le salon dédié aux annonces d'anniversaires. | `setbirthdaychannel [#salon / off]` | Admin |
| `setgoodbye` | Configure le message / salon d'au revoir. | `setgoodbye [#salon / off / message <texte>]` | Admin |
| `setgoodbyedm` | Configure le message privé (MP) envoyé quand un membre quitte le serveur. | `setgoodbyedm [on / off / <message>]` | Admin |
| `setjoinping` | Configure le ping d'arrivée des nouveaux membres. | `setjoinping [#salon] [ghost/permanent] / off` | Admin |
| `setlang` | Change la langue du bot pour le serveur (fr/en). | `setlang [fr/en]` | Admin |
| `setlevel` | Configure le salon et le message d'annonce des niveaux. | `setlevel [#salon / off / message <texte>]` | Admin |
| `setlog` | Configure les salons de logs catégorisés. | `setlog [setup / voice / raid / msg / mod / all] [#salon]` | Admin |
| `setmodrole` | Définit le rôle Modération global du bot. | `setmodrole [@role/off]` | Admin |
| `setprefix` | Modifie le préfixe du bot pour ce serveur. | `setprefix [nouveau préfixe]` | Admin |
| `setsanctiondm` | Définit le message de sanction envoyé en privé (MP). | `setsanctiondm [on/off/message]` | Admin |
| `setstarboard` | Configure le système de starboard. | `setstarboard <#salon / off> [nombre_etoiles]` | Admin |
| `setstatstext` | Définit le format du texte avant les statistiques des salons vocaux. | `setstatstext <type> <format>` | Admin |
| `setstatusrole` | Donne un rôle quand un membre a un texte précis dans son statut personnalisé. | `setstatusrole @Role [/nocoin .gg/nocoin] / off` | Admin |
| `setup` | Lance un setup rapide (création de salons de base). | `setup` | Admin |
| `setwelcome` | Configure le salon et le message de bienvenue. | `setwelcome [#salon / off / message <texte>]` | Admin |
| `setwelcomedm` | Définit le message de bienvenue envoyé en privé. | `setwelcomedm [on/off/message]` | Admin |
| `setwelcomemessage` | Configure un message texte de bienvenue (sans embed). | `setwelcomemessage [#salon / off / message <texte>]` | Admin |
| `theme` | Définit la couleur principale (thème) du bot de manière globale. | `theme [couleur hex]` | Owner |
| `unlockdown` | Déverrouille CHAQUE salon texte du serveur après un lockdown. | `unlockdown` | Admin |

## ✏️ Custom

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `addcmd` | Crée une commande personnalisée texte. | `addcmd [nom] [texte réponse]` | — |
| `customcmds` | Affiche toutes les commandes personnalisées du serveur. | `customcmds` | — |
| `delcmd` | Supprime une commande personnalisée texte. | `delcmd [nom]` | — |

## 💰 Économie

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `addmoney` | Ajoute de l'argent au portefeuille d'un membre. | `addmoney @user [montant]` | Admin |
| `balance` | Affiche le solde (argent) d'un membre. | `balance [@user]` | — |
| `blackjack` | Jouez au blackjack pour gagner des pièces. | `blackjack <mise>` · cooldown 10 s | — |
| `buy` | Achète un objet dans la boutique. | `buy [id item]` | — |
| `crime` | Tente un crime pour gagner beaucoup (mais avec des risques). | `crime` · cooldown 2 h | — |
| `daily` | Récupère ta récompense quotidienne. | `daily` | — |
| `deposit` | Dépose ton argent en banque pour le protéger des vols. | `deposit [montant/all]` | — |
| `fish` | Allez pêcher pour attraper des poissons rares. | `fish` · cooldown 3 min | — |
| `inventory` | Affiche l'inventaire d'un joueur. | `inventory [@user]` | — |
| `lbcoin` | Affiche le classement des membres les plus riches du serveur. | `lbcoin` | — |
| `mine` | Partez à la mine pour trouver des minerais précieux. | `mine` · cooldown 3 min | — |
| `pay` | Transfère de l'argent à un autre utilisateur. | `pay @user [montant]` | — |
| `removemoney` | Retire de l'argent du portefeuille d'un membre. | `removemoney @user [montant]` | Admin |
| `resetmoney` | Réinitialise le solde d'un utilisateur à zéro. | `resetmoney @user` | Admin |
| `rob` | Tente de voler un utilisateur. | `rob @user` · cooldown 1 h | — |
| `roulette` | Pariez vos pièces sur la roulette. | `roulette <mise> <noir/rouge/vert>` · cooldown 5 s | — |
| `setmoney` | Définit le solde d'un utilisateur. | `setmoney @user [montant]` | Admin |
| `shibuya` | Ouvre le Shibuya Casino (interface interactive). | `shibuya` | — |
| `shop` | Affiche la boutique du serveur. | `shop` | — |
| `shopembed` | Déploie un embed de boutique interactif. | `shopembed` | Admin |
| `slots` | Jouez à la machine à sous avec vos pièces. | `slots <mise>` · cooldown 5 s | — |
| `withdraw` | Retire ton argent de la banque. | `withdraw [montant/all]` | — |
| `work` | Travaille pour gagner un peu d'argent. | `work` · cooldown 1 h | — |

## 🎮 Fun

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `8ball` | Pose une question à la boule magique. | `8ball [question]` | — |
| `blague` | Raconte une blague aléatoire. | `blague` | — |
| `coinflip` | Parie ton argent sur Pile ou Face. | `coinflip [mise] [pile/face]` | — |
| `compliment` | Fais un compliment à quelqu'un. | `compliment [@user]` | — |
| `gay` | Affiche le % de gay de quelqu'un. | `gay [@user]` | — |
| `gif` | Cherche un GIF (via Tenor). | `gif [mot clé]` | — |
| `meme` | Affiche un mème aléatoire depuis Reddit. | `meme` | — |
| `pendu` | Joue au jeu du pendu. | `pendu` | — |
| `pfc` | Joue à Pierre-Feuille-Ciseaux contre le bot. | `pfc` | — |
| `pp` | Affiche la taille de PP (aléatoire). | `pp [@user]` | — |
| `quiz` | Pose une question de culture générale. | `quiz` | — |
| `rate` | Note quelque chose sur 100. | `rate [sujet]` | — |
| `roast` | Clash quelqu'un (pour rire). | `roast [@user]` | — |
| `roll` | Lance un ou plusieurs dés (ex : `+roll 2d6`). | `roll [NdN]` | — |
| `ship` | Calcule la compatibilité entre deux personnes. | `ship @user1 [@user2]` | — |
| `tictactoe` | Joue au morpion contre un autre joueur. | `tictactoe @user` | — |

## 📨 Invitations

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `addinvites` | Ajoute des invitations manuellement. | `addinvites @user [nombre]` | ManageGuild |
| `clearinvites` | Réinitialise les invitations d'un utilisateur. | `clearinvites @user` | ManageGuild |
| `invited` | Affiche qui a invité un utilisateur. | `invited [@user]` | — |
| `invites` | Affiche les invitations d'un utilisateur. | `invites [@user]` | — |
| `lockinvite` | Verrouille les invitations du serveur. | `lockinvite [on/off]` | ManageGuild |
| `removeinvite` | Retire des invitations à un utilisateur. | `removeinvite @user [nombre]` | ManageGuild |
| `topinvites` | Affiche le classement des invitations. | `topinvites` | — |

## 📈 Niveaux

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `addlevelrole` | Définit une récompense de rôle pour un niveau. | `addlevelrole [niveau] [@role]` | Admin |
| `dellevelrole` | Supprime une récompense de rôle pour un niveau. | `dellevelrole [niveau]` | Admin |
| `leaderboard` | Affiche le classement du serveur (XP ou Économie). | `leaderboard [eco]` | — |
| `levelroles` | Affiche les rôles donnés en récompense de niveau. | `levelroles` | — |
| `rank` | Affiche la carte de niveau d'un utilisateur. | `rank [@user]` | — |
| `resetxp` | Réinitialise l'XP d'un membre à zéro. | `resetxp @user` | Admin |
| `setxp` | Ajoute, retire ou définit l'XP d'un membre. | `setxp @user [montant]` | Admin |

## 🔨 Modération

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `addnote` | Ajoute une note à un utilisateur. | `addnote @user <note>` | ManageMessages |
| `autodelete` | Configure la suppression automatique de messages. | `autodelete enable / disable / channel #salon / time <durée>` | ManageMessages |
| `ban` | Bannit un membre du serveur. | `ban @user [raison]` | BanMembers |
| `baninfo` | Affiche des informations sur un bannissement. | `baninfo <@user/id>` | BanMembers |
| `banlist` | Affiche la liste des utilisateurs bannis du serveur. | `banlist` | BanMembers |
| `bringall` | Déplace tous les utilisateurs connectés en vocal vers un seul salon. | `bringall [salon]` | MoveMembers |
| `cellule` | Envoie un utilisateur en cellule (mute dans un salon vocal). | `cellule @utilisateur [raison]` | MoveMembers+MuteMembers |
| `clear` | Supprime un certain nombre de messages, éventuellement d'un membre spécifique. | `clear [nombre] [membre]` | ManageMessages |
| `clearall` | Supprime tous les messages du salon (avec confirmation). | `clearall` | ManageMessages+Admin |
| `clearwarns` | Supprime tous les avertissements d'un membre. | `clearwarns @user` | ManageMessages |
| `cmute` | Mute un utilisateur en vocal uniquement. | `cmute @user` | MuteMembers |
| `delnote` | Supprime une note d'un utilisateur. | `delnote @user <id>` | ManageMessages |
| `delwarn` | Supprime un avertissement d'un utilisateur. | `delwarn @user <id>` | ManageMessages |
| `derank` | Retire tous les rôles d'un utilisateur, sauf ceux ignorés. | `derank <membre> [raison] / ignore <role/del>` | ManageRoles |
| `derankall` | Retire tous les rôles à tous les membres possédant un rôle spécifique. | `derankall @role [raison]` | ManageRoles+Admin |
| `dog` | Force un utilisateur à vous suivre partout en vocal (troll). | `dog @user` | MoveMembers |
| `editban` | Modifie la raison d'un bannissement. | `editban <@user/id> <raison>` | BanMembers |
| `editmute` | Modifie la durée d'un mute. | `editmute @user <durée>` | ModerateMembers |
| `editnote` | Modifie une note d'un utilisateur. | `editnote @user <id> <texte>` | ManageMessages |
| `editwarn` | Modifie un avertissement d'un utilisateur. | `editwarn @user <id> <texte>` | ManageMessages |
| `gunban` | Bannit globalement un utilisateur de tous les serveurs du bot. | `gunban @utilisateur/ID [raison]` | BanMembers + Owner |
| `kick` | Expulse un membre du serveur. | `kick @user [raison]` | KickMembers |
| `limite` | Définit des limites pour les actions de modération. | `limite <warns/mutes/kicks/bans> <nombre>` | Admin |
| `lock` | Verrouille le salon actuel (empêche l'envoi de messages). | `lock [#salon/all]` | ManageChannels |
| `lockdown` | Verrouille tous les salons d'une catégorie. | `lockdown [<category_id/#salon/all/off>] [off]` | ManageChannels |
| `lockname` | Verrouille le changement de pseudo. | `lockname @utilisateur` | ManageNicknames |
| `locknamelist` | Affiche la liste des pseudos verrouillés. | `locknamelist` | ManageNicknames |
| `muteall` | Rend muet tous les membres du salon vocal où vous êtes. | `muteall` | MuteMembers |
| `mutelist` | Affiche la liste des utilisateurs mutés. | `mutelist` | ModerateMembers |
| `notes` | Affiche les notes d'un utilisateur. | `notes @user` | ManageMessages |
| `purge` | Supprime un certain nombre de messages dans le salon. | `purge [nombre]` | ManageMessages |
| `renew` | Clone un salon et supprime l'ancien instantanément pour l'effacer. | `renew` | ManageChannels |
| `report` | Signale un utilisateur au staff. | `report @utilisateur <raison>` | — |
| `rerank` | Redonne tous les rôles à un utilisateur. | `rerank @utilisateur` | ManageRoles |
| `sanctions` | Gère les sanctions du serveur. | `sanctions [clear @membre / clearall]` | ManageMessages |
| `slowmode` | Définit le mode lent du salon. | `slowmode [secondes (0 pour désactiver)]` | ManageChannels |
| `softban` | Banni et débanni instantanément un utilisateur (supprime les messages). | `softban @user [raison]` | BanMembers |
| `tempban` | Banni temporairement un utilisateur. | `tempban @utilisateur <durée: 1m, 1h, 1d> [raison]` | BanMembers |
| `tempmute` | Mute temporairement un utilisateur via Discord Timeout. | `tempmute @utilisateur <durée/preset> [raison]` | ModerateMembers |
| `temprole` | Gère les rôles temporaires. | `temprole <membre> <role> <durée> / list` | ManageRoles |
| `timeout` | Exclut temporairement (timeout) un membre du serveur. | `timeout @user [durée: 10m, 1h...] [raison]` | ModerateMembers |
| `unban` | Débannit un utilisateur ou tous les utilisateurs du serveur. | `unban <membre/all>` | BanMembers |
| `unbanall` | Débannit tous les utilisateurs du serveur d'un coup. | `unbanall` | BanMembers+Admin |
| `uncmute` | Unmute un utilisateur en vocal uniquement. | `uncmute @user` | MuteMembers |
| `undog` | Libère un utilisateur du suivi vocal. | `undog @user` | MoveMembers |
| `unlock` | Déverrouille le salon actuel. | `unlock [#salon/all]` | ManageChannels |
| `unlockname` | Déverrouille le changement de pseudo d'un utilisateur. | `unlockname @utilisateur` | ManageNicknames |
| `unmute` | Annule le timeout d'un membre. | `unmute @user` | ModerateMembers |
| `unmuteall` | Démute tous les membres du salon vocal où vous êtes. | `unmuteall` | MuteMembers |
| `unmuteallmassif` | Unmute tous les utilisateurs mutés. | `unmuteallmassif` | Admin |
| `voicemove` | Déplace un membre ou tous les membres d'un salon vocal. | `voicemove <membre/channel> [channel]` | MoveMembers |
| `warn` | Avertit un membre du serveur. | `warn @user [raison]` | ManageMessages |
| `warnings` | Affiche la liste des avertissements d'un membre. | `warnings @user` | — |

## 🎭 Rôles

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `addrole` | Ajoute un rôle à un membre. | `addrole @user @role` | ManageRoles |
| `buttonrole` | Gère les rôles assignables via boutons. | `buttonrole add <#salon> <messageId/new> <label> @role [style] / del <messageId> <customId> / list` | ManageRoles+Admin |
| `createrole` | Crée un nouveau rôle sur le serveur. | `createrole [Nom] [CouleurHex(optionnel)]` | ManageRoles |
| `delrole` | Supprime un rôle du serveur. | `delrole <role>` | ManageRoles |
| `massrole` | Applique ou retire un rôle en masse selon le filtre choisi. | `massrole <add/remove/bots/humans/inrole> @role [@targetRole]` | ManageRoles+Admin |
| `reactionrole` | Crée un panneau de rôle par réaction. | `reactionrole #salon @role :emoji: [description] / list / del <messageId> <emoji>` | ManageRoles+Admin |
| `removerole` | Retire un rôle à un membre. | `removerole @user @role` | ManageRoles |
| `selfrole` | Gère les rôles auto-attribuables (add, del, list, get, give, drop). | `selfrole <add/del/list/get/give/drop> [catégorie] [@role] [label]` | user : libre |

## 🔐 Sécurité

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `verifysetup` | Met en place le panneau de vérification Captcha pour les nouveaux membres. | `verifysetup [#salon] [@RoleMembre]` | Admin |

## 💗 Social

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `hug` | Fait un câlin à quelqu'un. | `hug @user` | — |
| `kiss` | Donne un bisou à quelqu'un. | `kiss @user` | — |
| `lettres` | Configure le système de Lettres Anonymes dans un salon. | `lettres #salon` | Admin |
| `mp` | Envoie un message privé à un utilisateur via le bot. | `mp <@user/ID> <message>` | Admin |
| `pat` | Tapote la tête de quelqu'un. | `pat @user` | — |
| `slap` | Donne une gifle à quelqu'un. | `slap @user` | — |

## 📊 Stats

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `activity` | Affiche l'activité globale du serveur. | `activity` | — |
| `msgcount` | Affiche le nombre total de messages envoyés par un membre (estimé via l'XP). | `msgcount [@user]` | — |
| `server-stats` | Affiche les statistiques rapides du serveur. | `server-stats` | — |
| `stats` | Affiche les statistiques générales du bot. | `stats` | — |

## 💡 Suggestions

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `replysuggest` | Accepte, refuse ou met à l'étude une suggestion. | `replysuggest [ID message] [accept/deny/consider] [raison]` | ManageMessages |
| `setsuggest` | Définit le salon où les suggestions seront envoyées. | `setsuggest [#salon]` | Admin |
| `suggest` | Propose une suggestion pour le serveur. | `suggest [idée]` | — |

## 🎫 Tickets

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `add` | Ajoute un utilisateur à un ticket. | `add [@user]` | — |
| `close` | Ferme et supprime le ticket actuel directement. | `close` | — |
| `remove` | Retire un utilisateur d'un ticket. | `remove [@user]` | — |
| `ticketaddoption` | Ajoute une option au menu déroulant des tickets via une interface interactive. | `ticketaddoption` | Admin |
| `ticketdeloption` | Supprime une option du menu déroulant des tickets. | `ticketdeloption <Titre_exact>` | Admin |
| `ticketgui` | Affiche le panneau de sélection de catégorie de tickets. | `ticketgui` | Admin |
| `ticketreason` | Active/désactive l'obligation d'indiquer une raison à l'ouverture d'un ticket. | `ticketreason <on/off>` | Admin |
| `ticketsetup` | Configure le système de tickets (Catégorie, Salon de logs, Rôle Staff). | `ticketsetup <category_id> <logs_channel_id> [staff_role_id]` | Admin |

## 🧰 Utilitaires

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `afk` | Vous signale comme absent (AFK). Le bot préviendra ceux qui vous mentionnent. | `afk [raison]` | — |
| `alladmin` | Affiche tous les administrateurs du serveur. | `alladmin` | — |
| `allbans` | Affiche tous les membres bannis du serveur. | `allbans` | BanMembers |
| `allbotadmins` | Affiche tous les administrateurs de bots. | `allbotadmins` | Admin |
| `allbots` | Affiche tous les bots du serveur. | `allbots` | — |
| `allcategory` | Affiche toutes les catégories de commandes. | `allcategory` | — |
| `allchannel` | Affiche tous les salons du serveur. | `allchannel` | — |
| `allemoji` | Affiche tous les emojis du serveur. | `allemoji` | — |
| `allnicks` | Affiche tous les pseudos des membres. | `allnicks` | — |
| `allprofil` | Affiche les profils de tous les membres. | `allprofil` | — |
| `allroles` | Affiche tous les rôles du serveur. | `allroles` | — |
| `allthread` | Affiche tous les fils de discussion du serveur. | `allthread` | — |
| `allvoices` | Affiche tous les salons vocaux du serveur. | `allvoices` | — |
| `articles` | Recherche des articles sur un sujet. | `articles <sujet>` | — |
| `avatar` | Affiche l'avatar (photo de profil) d'un utilisateur. | `avatar [@user]` | — |
| `avis` | Laisse un avis sur le serveur ou le bot. | `avis <texte/étoiles>` | — |
| `banner` | Affiche la bannière de profil d'un utilisateur. | `banner [@user]` | — |
| `botinfo` | Informations et statistiques du bot. | `botinfo` | — |
| `calc` | Calcule l'expression mathématique donnée. | `calc [expression]` | — |
| `channelinfo` | Informations sur un salon. | `channelinfo [#salon]` | — |
| `checkperm` | Vérifie les permissions d'un utilisateur. | `checkperm @user [perm]` | Admin |
| `color` | Affiche un aperçu de la couleur hexadécimale spécifiée. | `color [#hexCode]` | — |
| `decode` | Décode du texte encodé en Base64. | `decode [texte en base64]` | — |
| `editsnipe` | Affiche le dernier message édité dans ce salon. | `editsnipe` | — |
| `embed` | Créez un embed personnalisé de manière interactive via Interface Graphique. | `embed` | ManageMessages |
| `emote` | Affiche des informations sur un emoji. | `emote <emoji>` | — |
| `encode` | Encode du texte en Base64. | `encode [texte]` | — |
| `firstmsg` | Lien vers le premier message du salon. | `firstmsg` | — |
| `g-end` | Termine un giveaway prématurément. | `g-end [messageId]` | ManageMessages |
| `g-reroll` | Relance un giveaway terminé pour choisir de nouveaux gagnants. | `g-reroll [messageId]` | ManageMessages |
| `giveaway` | Lance un giveaway. | `giveaway [duree] [gagnants] [prix]` | ManageMessages |
| `get` | Récupère des informations sur un élément. | `get <user/role/channel> <cible>` | — |
| `getsticker` | Affiche des informations sur un sticker. | `getsticker <sticker>` | — |
| `help` | Affiche la liste complète des commandes (menu interactif). | `help [commande/catégorie]` | Admin |
| `helpcolor` | Affiche les couleurs disponibles pour le thème. | `helpcolor` | — |
| `helptest` | Affiche TOUTES les commandes du bot sans restriction. | `helptest [commande]` | Owner |
| `idemoji` | Récupère l'ID d'un emoji. | `idemoji <emoji>` | — |
| `idrole` | Récupère l'ID d'un rôle. | `idrole <@role/nom>` | — |
| `iduser` | Récupère l'ID d'un utilisateur. | `iduser <@user>` | — |
| `image` | Affiche une image aléatoire ou recherche une image. | `image <requête>` | — |
| `invite` | Génère un lien pour inviter le bot sur votre serveur. | `invite` | — |
| `lastping` | Affiche le dernier ping du bot. | `lastping` | — |
| `latence` | Affiche la latence du bot. | `latence` | — |
| `membercount` | Nombre de membres du serveur. | `membercount` | — |
| `meteo` | Affiche la météo pour une ville donnée. | `meteo [ville]` | — |
| `norole` | Affiche les membres sans rôle. | `norole` | ManageRoles |
| `onepage` | Affiche toutes les commandes sur une seule page. | `onepage` | — |
| `panel` | Dashboard complet du serveur. | `panel` | — |
| `ping` | Affiche la latence du bot. | `ping` | — |
| `profil` | Affiche le profil détaillé d'un utilisateur. | `profil [@user]` | — |
| `qrcode` | Génère un QR Code avec le lien ou le texte fourni. | `qrcode [texte/lien]` | — |
| `rappel` | Définit un rappel dans le temps (ex : 10m, 1h, 1d). | `rappel <durée> <message>` | — |
| `rename` | Renomme un salon. Le salon courant par défaut. | `rename [#salon] <nouveau-nom>` | ManageChannels |
| `roleadmin` | Affiche les rôles avec permissions d'administration. | `roleadmin` | — |
| `roleinfo` | Affiche les informations d'un rôle existant. | `roleinfo @role` | — |
| `rolemembers` | Affiche tous les membres ayant un rôle spécifique. | `rolemembers @role` | — |
| `search` | Recherche des informations sur Discord. | `search <requête>` | — |
| `server` | Affiche des informations détaillées sur le serveur. | `server` | — |
| `serverinfo` | Affiche des informations sur le serveur. | `serverinfo` | — |
| `snipe` | Affiche le dernier message supprimé dans ce salon. | `snipe` | — |
| `snipeedit` | Affiche le dernier message édité. | `snipeedit` | — |
| `snipeurl` | Surveille et réclame automatiquement une URL personnalisée (vanity) Discord dès qu'elle devient disponible. | `snipeurl <code/url> / stop / status / check <code/url>` | Admin |
| `snowaybots` | Affiche les bots sans le rôle BOT_ADMIN_ROLE. | `snowaybots` | — |
| `sondage` | Crée un sondage interactif. | `sondage <question>` | ManageMessages |
| `steal` | Vole un emoji et l'ajoute au serveur. | `steal <emoji> [nom]` | ManageGuildExpressions |
| `suggestbasic` | Fait une suggestion simple au serveur (sans vote). | `suggestbasic <texte>` | — |
| `timestamp` | Convertit une date en timestamp Discord. | `timestamp <date>` | — |
| `translate` | Traduit un texte. | `translate [langue cible (ex: fr, en, es)] [texte]` | — |
| `uptime` | Affiche depuis combien de temps le bot est en ligne. | `uptime` | — |
| `userinfo` | Affiche des informations sur un utilisateur. | `userinfo [@user]` | — |
| `variables` | Affiche les variables du serveur. | `variables` | Admin |
| `vocal` | Affiche les informations sur les salons vocaux. | `vocal` | — |
| `wiki` | Recherche sur Wikipédia. | `wiki <requête>` | — |

## 🎙️ Vocal

Système de salons vocaux privés : les commandes s'appliquent à votre salon temporaire créé via le hub TempVC.

| Commande | Description | Usage | Restriction |
|---|---|---|---|
| `bring` | Ramène un utilisateur dans votre salon vocal. | `bring <@user> [@user2 ...]` | — |
| `pv` | Rend votre salon vocal privé et affiche le panneau de contrôle. | `pv` | — |
| `tempvc` | Configure le système TempVC : catégorie, hub vocal et panneau de contrôle avec boutons. | `tempvc` | Admin |
| `unpv` | Désactive le mode privé de votre salon vocal. | `unpv` | — |
| `vaccess` | Donne l'accès à votre salon privé à un utilisateur. | `vaccess <@user/id>` | — |
| `vban` | Bannit un utilisateur de votre salon privé. | `vban <@user>` | — |
| `vbanlist` | Affiche la liste des bannis de votre salon privé. | `vbanlist` | — |
| `vbitrate` | Définit le bitrate (qualité audio) de votre salon privé. | `vbitrate <kbps>` | — |
| `vclose` | Supprime votre salon privé immédiatement. | `vclose` | — |
| `vghost` | Rend votre salon vocal invisible pour les autres. | `vghost` | — |
| `vkick` | Expulse un utilisateur de votre salon privé. | `vkick <@user>` | — |
| `vlimit` | Définit une limite d'utilisateurs pour votre salon privé. | `vlimit <nombre>` | — |
| `vlist` | Affiche la liste des membres whitelistés et bannis de votre salon. | `vlist` | — |
| `vlock` | Verrouille votre salon vocal privé. | `vlock` | — |
| `vmove` | Déplace un utilisateur de votre salon vers un autre. | `vmove <@user> <#salon>` | — |
| `voiceclaim` | Récupère les droits d'un salon vocal temporaire si le propriétaire est parti. | `voiceclaim` | — |
| `vrename` | Renomme votre salon privé. | `vrename <nom>` | — |
| `vtransfer` | Transfère la propriété de votre salon privé à quelqu'un d'autre. | `vtransfer <@user>` | — |
| `vunban` | Débannit un utilisateur de votre salon privé. | `vunban <@user>` | — |
| `vunghost` | Rend votre salon vocal visible à nouveau. | `vunghost` | — |
| `vunlock` | Déverrouille votre salon vocal privé. | `vunlock` | — |

---

## 🖥️ Le Dashboard web

En plus des commandes, VoltBot inclut un dashboard web (Express + React) :

```bash
npm run build:dashboard   # build le client React
npm start                 # démarre l'orchestrateur + toutes les instances
```

- **Gateway** sur le port **3000** → sert le dashboard et proxifie `/api/bot/<port>` vers les instances (3001-3005).
- Connexion par **phrase secrète** (définie via `SPEED_PHRASE` ou gérée dans `/api/system/speedphrases`).
- Onglets : statistiques, modules (activation antiraid etc.), configuration, économie, niveaux/rôles, casino, giveaways, logs, audit, sécurité, owners.

### Instances de bot

| Instance | Port dashboard | Description |
|---|---|---|
| `voltbot` | 3001 | instance principale |
| `nocoin` | 3002 | instance secondaire |
| `newbot` | 3003 | instance de test |

Chaque instance vit dans `bots/instances/<nom>/` avec son `.env` (token, OWNER_ID, JWT_SECRET, port) et sa base SQLite `data/bot.db`.

---

## 🆘 Dépannage rapide

| Problème | Solution |
|---|---|
| Le bot ne répond pas | `+ping` / `+latence` pour vérifier qu'il est en ligne ; vérifier `+setprefix` (préfixe custom) |
| Commande refusée | Vérifier la colonne Restriction ci-dessus + `+checkperm @user` |
| Une commande n'apparaît pas dans `+help` | Le help filtre selon vos droits — `+helptest` (Owner) liste tout |
| Économie incohérente | `+balance`, `+inventory` ; les admins ont `+setmoney`, `+resetmoney` |
| Raid en cours | `+lockall` puis activer les protections `+antiraid`, voir `+secur` |

> 📄 Pour l'audit technique complet du code (bugs corrigés, sécurité, recommandations), voir [RAPPORT_AUDIT.md](RAPPORT_AUDIT.md).
