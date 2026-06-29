const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "guildMemberRemove",
  async execute(member, client) {
    const guildSettings = client.db.getGuild(member.guild.id);
    const lang = guildSettings.language || "fr";

    const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);
    const memberAvatar = member.user.displayAvatarURL({ size: 256 });
    const joinedTs = member.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : t(lang, "events.guildMemberRemove.unknown");

    // Gate par module welcome (englobe les messages d'arrivée/départ) — re-vérifié à chaque event.
    const welcomeOn = client.db.isModuleEnabled(member.guild.id, "welcome");

    // --- MP de départ (Goodbye DM) ---
    if (welcomeOn && guildSettings.goodbyeDm === 1) {
      const rawMsg = (
        guildSettings.goodbyeDmMessage ||
        t(lang, "events.goodbye_default", { server: member.guild.name })
      )
        .replace(/{user}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{membercount}/g, member.guild.memberCount);

      try {
        const dmEmbed = client.embedBuilder
          .premium(
            client,
            member.guild.name,
            rawMsg,
            member.guild.iconURL({ size: 256 }),
          )
          .setAuthor({
            name: t(lang, "events.guildMemberRemove.leave_author"),
            iconURL: memberAvatar,
          })
          .setThumbnail(memberAvatar)
          .addFields(
            {
              name: t(lang, "events.guildMemberRemove.field_joined"),
              value: joinedTs,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberRemove.field_remaining"),
              value: `\`${fmtNum(member.guild.memberCount)}\``,
              inline: true,
            },
          );

        await member.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch (e) {
        // Fallback texte si l'embed échoue
        await member.send(rawMsg).catch(() => {});
      }
    }

    // Message de départ
    if (welcomeOn && guildSettings.goodbyeChannel) {
      const channel = member.guild.channels.cache.get(
        guildSettings.goodbyeChannel,
      );
      if (channel) {
        const msg = (
          guildSettings.goodbyeMessage ||
          t(lang, "events.goodbye_default", { server: member.guild.name })
        )
          .replace(/{user}/g, `**${member.user.username}**`)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount)
          .replace(/{mention}/g, `<@${member.id}>`);

        const embed = client.embedBuilder
          .premium(client, member.guild.name, msg, memberAvatar)
          .setAuthor({
            name: t(lang, "events.guildMemberRemove.leave_author"),
            iconURL: memberAvatar,
          })
          .setThumbnail(memberAvatar)
          .addFields(
            {
              name: t(lang, "events.guildMemberRemove.field_member"),
              value: `${member.user.tag}`,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberRemove.field_joined"),
              value: joinedTs,
              inline: true,
            },
            {
              name: t(lang, "events.guildMemberRemove.field_remaining"),
              value: `\`${fmtNum(member.guild.memberCount)}\``,
              inline: true,
            },
          );

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    // --- ANTI-KICK & ANTI-NUKE (KICK) ---
    // Gate par module antiraid — toggle dashboard pris en compte immédiatement.
    const antiraidConfig = client.db.isModuleEnabled(
      member.guild.id,
      "antiraid",
    )
      ? client.db.getAntiraidConfig(member.guild.id)
      : null;
    let kickLog = null;

    try {
      const { AuditLogEvent } = require("discord.js");

      // Attendre un peu pour que le log soit généré
      await new Promise((r) => setTimeout(r, 1500));
      const fetchedLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick,
      });
      kickLog = fetchedLogs.entries.first();

      if (antiraidConfig && antiraidConfig.antiKick > 0) {
        if (
          kickLog &&
          kickLog.target.id === member.id &&
          Date.now() - kickLog.createdTimestamp < 10000
        ) {
          const { executor } = kickLog;
          if (executor && executor.id !== client.user.id) {
            const perms = require("../utils/permissions");
            const isExempted = perms.isWhitelisted(
              executor.id,
              member.guild.id,
              client,
              guildSettings,
              "antiNuke",
            );

            if (!isExempted) {
              // Mass kick counter (Nuke)
              if (!client.nukeCounters) client.nukeCounters = new Map();
              const nukeKey = `${executor.id}_kicks`;
              const userData = client.nukeCounters.get(nukeKey) || {
                count: 0,
                firstAction: Date.now(),
              };

              if (Date.now() - userData.firstAction > 60000) {
                userData.count = 1;
                userData.firstAction = Date.now();
              } else {
                userData.count++;
              }
              client.nukeCounters.set(nukeKey, userData);

              const nukeLimit = antiraidConfig.nukeKickLimit || 3;
              const isNuke =
                antiraidConfig.antiNuke > 0 && userData.count >= nukeLimit;

              const executorMember = await member.guild.members
                .fetch(executor.id)
                .catch(() => null);
              if (executorMember) {
                const moduleName = isNuke ? "antiNuke" : "antiKick";
                const actionResult =
                  await client.utils.antiraid.processSanction(
                    executorMember,
                    moduleName,
                    isNuke
                      ? t(lang, "events.guildMemberRemove.reason_mass_kick_detected")
                      : t(lang, "events.guildMemberRemove.reason_kick_unauthorized"),
                    client,
                  );
                logger.event(
                  `[ANTIRAID] ${executor.tag} sanctionné via ${moduleName} : ${actionResult}`,
                );
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-KICK] Erreur AuditLog: ${err.message}`, err);
    }

    // Mod-Logs (Leave/Kick)
    const logChannelId =
      client.db.resolveLogChannel(member.guild.id, "fluxlog", "leave") ||
      client.db.resolveLogChannel(member.guild.id, "modlog", "kick");
    if (logChannelId) {
      const channel = member.guild.channels.cache.get(logChannelId);
      if (channel) {
        let executor = null;
        if (
          kickLog &&
          kickLog.target.id === member.id &&
          Date.now() - kickLog.createdTimestamp < 10000
        ) {
          executor = kickLog.executor;
        }

        let embed;
        if (executor) {
          embed = client.embedBuilder.modLog(
            client,
            t(lang, "events.guildMemberRemove.modlog_kick_title"),
            member.user,
            executor,
            kickLog?.reason ||
              t(lang, "events.guildMemberRemove.no_reason"),
            [],
            lang,
          );
        } else {
          embed = client.embedBuilder
            .base(client, t(lang, "events.guildMemberRemove.leave_title"))
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .addFields(
              {
                name: t(lang, "events.guildMemberRemove.field_member"),
                value: `<@${member.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.guildMemberRemove.field_remaining"),
                value: `\`${new Intl.NumberFormat("fr-FR").format(member.guild.memberCount)}\``,
                inline: true,
              },
              {
                name: t(lang, "events.guildMemberRemove.field_joined"),
                value: joinedTs,
                inline: true,
              },
            );
        }
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  },
};
