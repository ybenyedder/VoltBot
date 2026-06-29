const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "guildMemberAdd",
  async execute(member, client) {
    const guildSettings = client.db.getGuild(member.guild.id);
    const lang = guildSettings.language || "fr";

    // Anti-Raid & Anti-Bot — gate par module antiraid (toggle dashboard).
    const antiraidModuleOn = client.db.isModuleEnabled(
      member.guild.id,
      "antiraid",
    );
    const antiraid = antiraidModuleOn
      ? client.db.getAntiraidConfig(member.guild.id)
      : null;
    if (antiraid) {
      // 1. Anti-Bot
      if (antiraid.antiBot > 0 && member.user.bot) {
        try {
          const fetchedLogs = await member.guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd })
            .catch(() => null);
          const log = fetchedLogs?.entries.first();

          if (log && Date.now() - log.createdTimestamp < 30000) {
            const { executor } = log;
            if (executor && executor.id !== client.user.id) {
              const perms = require("../utils/permissions");
              if (
                perms.isWhitelisted(
                  executor.id,
                  member.guild.id,
                  client,
                  guildSettings,
                  "antiBot",
                )
              ) {
                // Owner or Whitelisted bypass
              } else {
                const execMember = await member.guild.members
                  .fetch(executor.id)
                  .catch(() => null);
                if (execMember) {
                  const actionResult =
                    await client.utils.antiraid.processSanction(
                      execMember,
                      "antiBot",
                      t(lang, "events.guildMemberAdd.reason_bot_add_unauthorized"),
                      client,
                    );
                  logger.event(
                    `[ANTI-BOT] ${executor.tag} sanctionné via antiBot : ${actionResult}`,
                  );
                }
              }
            }
          }
        } catch (err) {
          logger.error(`[ANTI-BOT] Erreur: ${err.message}`, err);
        }

        return member
          .kick(t(lang, "events.guildMemberAdd.reason_anti_bot_active"))
          .catch(() => {});
      }

      // 2. Anti-Join (Raid Mode)
      if (antiraid.raidMode > 0 && !member.user.bot) {
        return member
          .kick(t(lang, "events.guildMemberAdd.reason_anti_join_active"))
          .catch(() => {});
      }
    }

    // Auto-rôle
    if (guildSettings.autoRole) {
      const role = member.guild.roles.cache.get(guildSettings.autoRole);
      if (role) {
        member.roles.add(role).catch(() => {});
      }
    }

    const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);
    const createdTs = Math.floor(member.user.createdTimestamp / 1000);
    const memberAvatarLg = member.user.displayAvatarURL({ size: 1024 });
    const memberAvatar = member.user.displayAvatarURL({ size: 256 });
    const accountAgeDays = Math.floor(
      (Date.now() - member.user.createdTimestamp) / 86400000,
    );
    const ageLabel =
      accountAgeDays >= 365
        ? `${Math.floor(accountAgeDays / 365)} an${accountAgeDays >= 730 ? "s" : ""}`
        : accountAgeDays >= 30
          ? `${Math.floor(accountAgeDays / 30)} mois`
          : `${accountAgeDays} j`;

    // Message de bienvenue en DM
    if (
      guildSettings.welcomeDm &&
      client.db.isModuleEnabled(member.guild.id, "welcome")
    ) {
      const rawDmMsg = (
        guildSettings.welcomeDmMessage ||
        t(lang, "events.welcome_default", { server: member.guild.name })
      )
        .replace(/{user}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{membercount}/g, member.guild.memberCount)
        .replace(/{mention}/g, `<@${member.id}>`);

      try {
        const dmEmbed = client.embedBuilder
          .premium(client, member.guild.name, rawDmMsg, memberAvatar)
          .setAuthor({
            name: t(lang, "events.guildMemberAdd.welcome_author", {
              user: member.user.username,
            }),
            iconURL: memberAvatar,
          })
          .setThumbnail(memberAvatar)
          .addFields(
            {
              name: t(lang, "events.guildMemberAdd.field_member"),
              value: `\`#${fmtNum(member.guild.memberCount)}\``,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberAdd.field_account"),
              value: `\`${ageLabel}\``,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberAdd.field_created"),
              value: `<t:${createdTs}:R>`,
              inline: true,
            },
          )
          .setFooter({
            text: t(lang, "events.guildMemberAdd.footer_members", {
              server: member.guild.name,
              count: fmtNum(member.guild.memberCount),
            }),
            iconURL:
              member.guild.iconURL({ size: 64 }) ||
              client.user.displayAvatarURL({ size: 64 }),
          });
        await member.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch (e) {
        // Fallback texte si l'embed échoue
        await member.send(rawDmMsg).catch(() => {});
      }
    }

    // Message de bienvenue
    if (
      guildSettings.welcomeChannel &&
      client.db.isModuleEnabled(member.guild.id, "welcome")
    ) {
      const channel = member.guild.channels.cache.get(
        guildSettings.welcomeChannel,
      );
      if (channel) {
        const msg = (
          guildSettings.welcomeMessage ||
          t(lang, "events.welcome_default", { server: member.guild.name })
        )
          .replace(/{user}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount)
          .replace(/{mention}/g, `<@${member.id}>`);

        const embedTitle = guildSettings.welcomeTitle || member.guild.name;
        const welcomeEmbed = client.embedBuilder
          .premium(client, embedTitle, `<@${member.id}>\n${msg}`, memberAvatar)
          .setAuthor({
            name: t(lang, "events.guildMemberAdd.welcome_author", {
              user: member.user.username,
            }),
            iconURL: memberAvatar,
          })
          .setThumbnail(memberAvatarLg)
          .addFields(
            {
              name: t(lang, "events.guildMemberAdd.field_member"),
              value: `\`#${fmtNum(member.guild.memberCount)}\``,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberAdd.field_account"),
              value: `\`${ageLabel}\``,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberAdd.field_created"),
              value: `<t:${createdTs}:R>`,
              inline: true,
            },
          )
          .setFooter({
            text: t(lang, "events.guildMemberAdd.footer_members", {
              server: member.guild.name,
              count: fmtNum(member.guild.memberCount),
            }),
            iconURL:
              member.guild.iconURL({ size: 64 }) ||
              client.user.displayAvatarURL({ size: 64 }),
          });

        if (guildSettings.welcomeGif) {
          welcomeEmbed.setImage(guildSettings.welcomeGif);
        }

        await channel
          .send({
            content: `<@${member.id}>`,
            embeds: [welcomeEmbed],
            allowedMentions: { users: [member.id] },
          })
          .catch(() => {});
      }
    }

    // Message texte de bienvenue (sans embed) — peut coexister avec l'embed
    if (
      guildSettings.welcomeTextChannel &&
      guildSettings.welcomeTextMessage &&
      client.db.isModuleEnabled(member.guild.id, "welcome")
    ) {
      const txtChannel = member.guild.channels.cache.get(
        guildSettings.welcomeTextChannel,
      );
      if (txtChannel) {
        const txt = guildSettings.welcomeTextMessage
          .replace(/{user}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount)
          .replace(/{mention}/g, `<@${member.id}>`);
        await txtChannel
          .send({
            content: txt,
            allowedMentions: { users: [member.id] },
          })
          .catch(() => {});
      }
    }

    // Join Ping — ghost (supprimé après 3s) ou permanent selon la config
    const pingChannels = [];
    if (client.db.isModuleEnabled(member.guild.id, "joinping")) {
      if (guildSettings.joinPingChannel)
        pingChannels.push(guildSettings.joinPingChannel);
      if (guildSettings.joinPingChannels) {
        try {
          const list =
            typeof guildSettings.joinPingChannels === "string"
              ? JSON.parse(guildSettings.joinPingChannels)
              : guildSettings.joinPingChannels;
          if (Array.isArray(list)) {
            list.forEach((id) => {
              if (!pingChannels.includes(id)) pingChannels.push(id);
            });
          }
        } catch (e) {}
      }
    }

    if (pingChannels.length > 0) {
      const pingMode = guildSettings.joinPingMode || "ghost";
      pingChannels.forEach((channelId) => {
        const pingChannel = member.guild.channels.cache.get(channelId);
        if (pingChannel) {
          if (pingMode === "permanent") {
            pingChannel.send(`<@${member.id}>`).catch(() => {});
          } else {
            pingChannel
              .send(`<@${member.id}>`)
              .then((m) => {
                setTimeout(() => m.delete().catch(() => {}), 3000);
              })
              .catch(() => {});
          }
        }
      });
    }
    // Mod-Logs (Join)
    const logChannelId =
      client.db.resolveLogChannel(member.guild.id, "fluxlog", "join") ||
      client.db.resolveLogChannel(member.guild.id, "raidlog", "join") ||
      client.db.resolveLogChannel(member.guild.id, "modlog", "join");
    if (logChannelId) {
      const channel = member.guild.channels.cache.get(logChannelId);
      if (channel) {
        const embed = client.embedBuilder
          .base(client, t(lang, "events.guildMemberAdd.log_join_title"))
          .setThumbnail(memberAvatar)
          .addFields(
            {
              name: t(lang, "events.guildMemberAdd.field_member"),
              value: `<@${member.id}>`,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberAdd.field_position"),
              value: `\`#${fmtNum(member.guild.memberCount)}\``,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberAdd.field_account_created"),
              value: `<t:${createdTs}:R>`,
              inline: true,
            },
          );
        await channel
          .send({ embeds: [embed] })
          .catch((err) =>
            logger.error(
              `[GUILD_MEMBER_ADD] Failed to send mod log embed: ${err.message}`,
            ),
          );
      }
    }
  },
};
