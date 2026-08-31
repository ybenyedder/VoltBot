const {
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const logger = require("../utils/logger");
const cooldowns = require("../utils/cooldowns");
const generateLevelCard = require("../utils/levelCard");
const permissions = require("../utils/permissions");
const { handleAutomod } = require("./handlers/automodHandler");
const { executeSafe } = require("../utils/errorHandler");
const { t } = require("../utils/i18n");

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    try {
      // Ignorer les messages des bots et en DM
      if (message.author?.bot || !message.guild) return;

      // Récupérer la configuration du serveur (cache partagé client — invalidé par le dashboard)
      let guildSettings = client.guildSettingsCache.get(message.guild.id);
      if (!guildSettings) {
        guildSettings = client.db.getGuild(message.guild.id);
        client.guildSettingsCache.set(message.guild.id, guildSettings);
      }
      const prefix = guildSettings.prefix || client.config.prefix;
      // --- HONEYPOT ---
      if (guildSettings.honeypotChannel && message.channel.id === guildSettings.honeypotChannel) {
        await message.delete().catch(() => {});

        // Incrémenter le compteur
        client.db.db.prepare("UPDATE guilds SET honeypotCount = COALESCE(honeypotCount,0) + 1 WHERE guildId = ?").run(message.guild.id);
        const updated = client.db.getGuild(message.guild.id);
        client.guildSettingsCache.set(message.guild.id, updated);
        const newCount = updated.honeypotCount || 1;

        // Mettre à jour l embed dans le salon honeypot
        if (updated.honeypotMessageId) {
          try {
            const hpMsg = await message.channel.messages.fetch(updated.honeypotMessageId);
            if (hpMsg && hpMsg.author.id === client.user.id) {
              const { buildEmbed } = require("../commands/admin/honeypot");
              const updatedEmbed = await buildEmbed(newCount);
              await hpMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
            }
          } catch (_) {}
        }

        // Supprimer les 5 derniers messages du membre dans tous les salons
        const textChannels = message.guild.channels.cache.filter(c => c.isTextBased && c.isTextBased() && c.id !== message.channel.id);
        let deleted = 0;
        for (const [, ch] of textChannels) {
          if (deleted >= 5) break;
          try {
            const msgs = await ch.messages.fetch({ limit: 50 });
            const userMsgs = [...msgs.filter(m => m.author.id === message.author.id).values()].slice(0, 5 - deleted);
            for (const m of userMsgs) {
              await m.delete().catch(() => {});
              deleted++;
              if (deleted >= 5) break;
            }
          } catch (_) {}
        }
        return;
      }


      // Langue du serveur — bind un traducteur sur le message pour que toutes
      // les commandes (execute(client, message, args)) puissent faire message.t(key).
      const lang = guildSettings.language || "fr";
      message.lang = lang;
      message.t = (key, vars) => t(lang, key, vars);

      // --- GESTION AFK ---
      // Enlever l'AFK de l'auteur
      const isAfk = client.db.getAfk(message.author?.id, message.guild.id);
      if (isAfk && message.author?.id) {
        client.db.deleteAfk(message.author.id, message.guild.id);
        message
          .reply({
            content: t(lang, "core.dispatch.afk_back", { user: message.author }),
          })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
          .catch(() => {});
      }
      // Vérifier si quelqu'un de mentionné est AFK
      if (message.mentions.members.size > 0) {
        message.mentions.members.forEach((member) => {
          const targetAfk = client.db.getAfk(member.id, message.guild.id);
          if (targetAfk) {
            message
              .reply({
                content: t(lang, "core.dispatch.afk_mentioned", {
                  user: member.user.username,
                  reason: targetAfk.reason,
                  since: `<t:${Math.floor(targetAfk.timestamp / 1000)}:R>`,
                }),
              })
              .catch(() => {});
          }
        });
      }

      // --- AUTO-RÉACTIONS DE SALON ---
      // Réagit automatiquement aux nouveaux messages dans les salons configurés.
      if (!message.content.startsWith(prefix)) {
        try {
          const row = client.db.db
            .prepare(
              "SELECT emojis FROM autoreact_channels WHERE guildId = ? AND channelId = ?",
            )
            .get(message.guild.id, message.channel.id);
          if (row && row.emojis) {
            const emojis = JSON.parse(row.emojis);
            for (const e of emojis) {
              await message.react(e).catch(() => {});
            }
          }
        } catch (e) {
          logger.error(`[AUTOREACT] ${e.message}`);
        }
      }

      // --- AUTOMODÉRATION (LOGIQUE CENTRALISÉE) ---
      // Le module antiraid peut être désactivé via le dashboard — vérification à chaque message.
      if (client.db.isModuleEnabled(message.guild.id, "antiraid")) {
        const automodTriggered = await handleAutomod(
          message,
          client,
          guildSettings,
        );
        if (automodTriggered) return;
      }

      // --- SYSTÈME DE DROPS ALÉATOIRES (COFFRES) ---
      // 1 chance sur 100 de faire spawn un coffre
      const dropChance = Math.floor(Math.random() * 100);
      if (
        dropChance === 1 &&
        !message.content.startsWith(prefix) &&
        client.db.isModuleEnabled(message.guild.id, "economy") &&
        guildSettings.dropsEnabled !== 0
      ) {
        // Cooldown de drop par serveur (1 drop max toutes les 5 minutes)
        if (!client.dropCooldowns) client.dropCooldowns = new Map();
        const lastDrop = client.dropCooldowns.get(message.channel.id);

        if (!lastDrop || Date.now() - lastDrop > 300000) {
          // Vérification des salons autorisés
          const dropChannels = JSON.parse(guildSettings.dropChannels || "[]");
          if (
            dropChannels.length > 0 &&
            !dropChannels.includes(message.channel.id)
          ) {
            return; // Ce salon n'est pas autorisé
          }

          client.dropCooldowns.set(message.channel.id, Date.now());

          const amount = Math.floor(Math.random() * 400) + 100; // Entre 100 et 500 coins

          const dropEmbed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle(t(lang, "core.dispatch.drop_title"))
            .setDescription(
              t(lang, "core.dispatch.drop_description", {
                amount,
                coin: client.config.emojis.coin,
              }),
            )
            .setThumbnail(
              "https://cdn-icons-png.flaticon.com/512/3241/3241031.png",
            );

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`drop_claim_${amount}`)
              .setLabel(t(lang, "core.dispatch.drop_button"))
              .setStyle(ButtonStyle.Primary),
          );

          message.channel
            .send({ embeds: [dropEmbed], components: [row] })
            .catch(() => {});
        }
      }

      // --- SYSTÈME D'EXPÉRIENCE (XP) ---
      // Gate par module levels — re-vérifié à chaque message pour rester
      // synchrone avec les toggles dashboard. Si le module est désactivé,
      // on retourne quand même pour les messages sans préfixe (pas de commande).
      if (!message.content.startsWith(prefix)) {
        if (!client.db.isModuleEnabled(message.guild.id, "levels")) return;
        // Atomic XP += delta + recomputed level — collapses the previous
        // SELECT/UPDATE/SELECT/UPDATE sequence so two messages arriving at
        // the same time can't lose XP or skip a level-up.
        const xpDelta = Math.floor(Math.random() * 15) + 10;
        const result = client.db.addXpAndSyncLevel(
          message.author.id,
          message.guild.id,
          xpDelta,
          (xp) => Math.floor(Math.sqrt(xp / 100)),
        );
        const curLevel = result.level;

        if (result.leveledUp && curLevel > 0) {

          // Annonce de niveau avec carte Canvas premium
          if (guildSettings.levelChannel) {
            const channel = message.guild.channels.cache.get(
              guildSettings.levelChannel,
            );
            if (channel) {
              try {
                const card = await generateLevelCard(
                  message.member,
                  curLevel,
                  lang,
                );
                channel.send({
                  content: `<@${message.author.id}>`,
                  files: [card],
                  allowedMentions: { users: [message.author.id] },
                });
              } catch (e) {
                channel.send({
                  content: `<@${message.author.id}>`,
                  allowedMentions: { users: [message.author.id] },
                });
              }
            }
          }

          // Récompense de rôle de niveau
          const levelRole = client.db.getLevelRole(message.guild.id, curLevel);
          if (levelRole) {
            const roleToAdd = message.guild.roles.cache.get(levelRole.roleId);
            if (roleToAdd) {
              message.member.roles.add(roleToAdd).catch(() => {});
            }
          }
        }
        return;
      }

      // --- SYSTÈME DE COMMANDES ---
      // Blacklist globale: l'utilisateur ne peut exécuter aucune commande.
      if (
        typeof client.db.isBlacklisted === "function" &&
        client.db.isBlacklisted(message.author.id)
      ) {
        return;
      }

      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command =
        client.commands.get(commandName) ||
        client.commands.get(client.aliases.get(commandName));

      // Commandes Custom si pas de commande native
      if (!command) {
        const customCmd = client.db.getCustomCommand(
          message.guild.id,
          commandName,
        );
        if (customCmd) {
          return message.channel.send({ content: customCmd.response });
        }
        if (client.config.suggestTypos) {
          const lev = (a, b) => {
            if (a === b) return 0;
            if (!a.length) return b.length;
            if (!b.length) return a.length;
            const p = new Array(b.length + 1);
            for (let j = 0; j <= b.length; j++) p[j] = j;
            for (let i = 1; i <= a.length; i++) {
              let cur = i;
              for (let j = 1; j <= b.length; j++) {
                const c = a[i - 1] === b[j - 1] ? 0 : 1;
                const nx = Math.min(cur + 1, p[j] + 1, p[j - 1] + c);
                p[j - 1] = cur; cur = nx;
              }
              p[b.length] = cur;
            }
            return p[b.length];
          };
          let best = null, bestScore = Infinity;
          client.commands.forEach((cmd) => {
            for (const n of [cmd.name, ...(cmd.aliases || [])]) {
              const d = lev(commandName, n.toLowerCase());
              if (d < bestScore) { bestScore = d; best = cmd.name; }
            }
          });
          if (best && bestScore <= 3) {
            message
              .reply({
                embeds: [
                  client.embedBuilder.warning(
                    client,
                    t(lang, "core.dispatch.unknown_command", {
                      cmd: `\`${prefix}${best}\``,
                    }),
                  ),
                ],
              })
              .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
              .catch(() => {});
          }
        }
        return; // Ne pas continuer si la commande n'existe pas
      }

      // Bypass complet pour Primary Owner et Whitelist
      const isExempted = permissions.isWhitelisted(
        message.author.id,
        message.guild.id,
        client,
        guildSettings,
      );
      const isSecondaryOwner = permissions.isBotOwner(
        client,
        message.author.id,
      );
      const isAdmin =
        message.member.permissions.has(PermissionFlagsBits.Administrator) ||
        message.author.id === message.guild.ownerId;

      if (!isExempted) {
        // 1. Restriction des salons publics
        if (!isSecondaryOwner && !isAdmin) {
          const publicChannels = JSON.parse(
            guildSettings.publicChannels || "[]",
          );
          const publicCategories = [
            "utility",
            "fun",
            "games",
            "economy",
            "levels",
            "invites",
          ];

          if (
            publicChannels.length > 0 &&
            command.category &&
            publicCategories.includes(command.category.toLowerCase())
          ) {
            if (!publicChannels.includes(message.channel.id)) {
              return message
                .reply({
                  embeds: [
                    client.embedBuilder.error(
                      client,
                      t(lang, "core.dispatch.public_not_allowed"),
                    ),
                  ],
                })
                .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
                .catch(() => {});
            }
          }
        }

        // 2. Commandes extrêmement sensibles (Créateur uniquement)
        if (command.ownerOnly && !permissions.isOwner(message)) {
          return message
            .reply({
              embeds: [
                client.embedBuilder.error(
                  client,
                  t(lang, "core.dispatch.owner_only"),
                ),
              ],
            })
            .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
            .catch(() => {});
        }

        // 3. Commandes avec permissions spécifiques
        if (!isAdmin && !isSecondaryOwner) {
          try {
            const memberRoleIds = message.member.roles.cache.map((r) => r.id);
            const rolePerms = client.db.getRolePermissions
              ? client.db.getRolePermissions(
                  message.guild.id,
                  memberRoleIds,
                  command.name,
                )
              : [];

            if (command.userPerms) {
              const hasPerms = message.member.permissions.has(
                command.userPerms,
              );
              if (!hasPerms && rolePerms.length === 0) {
                return message
                  .reply({
                    embeds: [
                      client.embedBuilder.error(
                        client,
                        t(lang, "core.dispatch.access_denied_perms"),
                      ),
                    ],
                  })
                  .then((m) =>
                    setTimeout(() => m.delete().catch(() => {}), 5000),
                  )
                  .catch(() => {});
              }
            } else {
              // Commande sans perms Discord — si des rolePerms sont configurés, les appliquer
              const hasAnyRolePerm = client.db.commandHasRolePerms
                ? client.db.commandHasRolePerms(message.guild.id, command.name)
                : false;
              if (hasAnyRolePerm && rolePerms.length === 0) {
                return message
                  .reply({
                    embeds: [
                      client.embedBuilder.error(
                        client,
                        t(lang, "core.dispatch.access_denied_role"),
                      ),
                    ],
                  })
                  .then((m) =>
                    setTimeout(() => m.delete().catch(() => {}), 5000),
                  )
                  .catch(() => {});
              }
            }
            // Si pas de userPerms et pas de rolePerms configurés commande publique, on laisse passer.
          } catch (e) {
            logger.error("Erreur check permissions :", e);
            return;
          }
        }
      }

      // Si on arrive ici : Soit c'est le OWNER, soit BOT OWNER, soit il est autorisé via roleperm pour cette commande précise.

      // On vérifie juste les perms du bot pour qu'il puisse fonctionner
      if (command.botPerms) {
        if (!message.guild.members.me.permissions.has(command.botPerms)) {
          return message
            .reply({
              embeds: [
                client.embedBuilder.error(
                  client,
                  t(lang, "core.dispatch.bot_missing_perms", {
                    perms: client.embedBuilder.formatPerms(command.botPerms, lang),
                  }),
                ),
              ],
            })
            .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
            .catch(() => {});
        }
      }

      // Vérification du cooldown
      const cooldownTime = cooldowns.check(client, command, message);
      if (cooldownTime) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                t(lang, "core.dispatch.cooldown", {
                  time: cooldownTime.toFixed(1),
                  cmd: command.name,
                }),
              ),
            ],
          })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
          .catch(() => {});
      }

      // Vérification de l'activation du module
      // Map command.category (= parent directory of the command file) to the
      // dashboard module namespace (DEFAULT_MODULES in core/dashboard/manager.js).
      // Categories mapped to "core" intentionally bypass module gating — they
      // are administrative, structural, or always-on utilities that have no
      // matching DEFAULT_MODULES entry (the dashboard cannot toggle them).
      if (command.category) {
        const moduleMap = {
          // Toggleable modules (must match DEFAULT_MODULES entries)
          moderation: "moderation",
          economy: "economy",
          casino: "casino",
          music: "music",
          fun: "fun",
          tickets: "tickets",
          levels: "levels",
          logs: "logs",
          antiraid: "antiraid",
          // Whitelisted (always-on) — no DEFAULT_MODULES entry, bypass gating
          config: "core",
          admin: "core",
          utility: "core",
          information: "core",
          backup: "core",
          birthdays: "core",
          custom: "core",
          invitations: "core",
          roles: "core",
          security: "core",
          social: "core",
          stats: "core",
          suggestions: "core",
          voice: "core",
        };

        const catName = command.category.toLowerCase();
        const moduleName = moduleMap[catName];

        if (
          moduleName &&
          moduleName !== "core" &&
          !client.db.isModuleEnabled(message.guild.id, moduleName)
        ) {
          return message
            .reply({
              embeds: [
                client.embedBuilder.error(
                  client,
                  t(lang, "core.dispatch.module_disabled", {
                    module: moduleName,
                  }),
                ),
              ],
            })
            .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
            .catch(() => {});
        }
      }

      // Exécution de la commande
      if (process.env.DEBUG_MODE) {
        logger.cmd(`${message.author.tag} executing ${command.name}`);
      }

      await executeSafe(client, message, command.name, async () => {
        await command.execute(client, message, args);
      });
    } catch (globalError) {
      logger.error(
        "[Anti-Crash messageCreate] Erreur interceptée avant le crash du bot :",
        globalError,
      );
    }
  },
};
