const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "channelDelete",
  async execute(channel, client) {
    if (!channel.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete,
      });
      const log = fetchedLogs.entries.first();

      let executor = null;
      if (log && Date.now() - log.createdTimestamp < 30000) {
        executor = log.executor;
      }

      // --- LOGGING ---
      const gs = client.db.getGuild(channel.guild.id);
      const lang = gs.language || "fr";
      const logChannelId =
        client.db.resolveLogChannel(channel.guild.id, "channellog", "delete") ||
        client.db.resolveLogChannel(channel.guild.id, "raidlog", "delete") ||
        client.db.resolveLogChannel(channel.guild.id, "modlog", "delete");
      if (logChannelId) {
        const channelObj = channel.guild.channels.cache.get(logChannelId);
        if (channelObj) {
          const createdTs = Math.floor(channel.createdTimestamp / 1000);
          const embed = client.embedBuilder
            .base(client, t(lang, "events.channelDelete.title"))
            .addFields(
              {
                name: t(lang, "events.channelDelete.field_channel"),
                value: `\`#${channel.name}\``,
                inline: true,
              },
              {
                name: t(lang, "events.channelDelete.field_type"),
                value: `\`${channel.type}\``,
                inline: true,
              },
              {
                name: t(lang, "events.channelDelete.field_executor"),
                value: executor
                  ? `<@${executor.id}>`
                  : t(lang, "events.channelDelete.unknown"),
                inline: true,
              },
              {
                name: t(lang, "events.channelDelete.field_created"),
                value: `<t:${createdTs}:R>`,
                inline: true,
              },
            );
          await channelObj.send({ embeds: [embed] }).catch(() => {});
        }
      }

      // --- ANTIRAID PROTECTION ---
      const config = client.db.getAntiraidConfig(channel.guild.id);
      if (
        config &&
        config.antiChannel > 0 &&
        executor &&
        executor.id !== client.user.id
      ) {
        if (
          !require("../utils/permissions").isWhitelisted(
            executor.id,
            channel.guild.id,
            client,
            gs,
            "antiChannel",
          )
        ) {
          // Anti-Nuke counter
          if (!client.nukeCounters) client.nukeCounters = new Map();
          const nukeKey = `${executor.id}_channels`;
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

          const nukeLimit = config.nukeChannelLimit || 3;
          const isNuke = config.antiNuke > 0 && userData.count >= nukeLimit;

          const member = await channel.guild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              "antiChannel",
              t(lang, "events.channelDelete.sanction_reason"),
              client,
            );
            logger.event(
              `[ANTI-CHANNEL] ${executor.tag} sanctionné — suppression de salon : ${actionResult}`,
            );

            // Recréer le salon supprimé
            const permissionOverwrites =
              log?.changes?.find((c) => c.key === "permission_overwrites")
                ?.new || [];
            await channel.guild.channels
              .create({
                name: channel.name,
                type: channel.type,
                position: channel.position,
                parent: channel.parentId,
                permissionOverwrites: permissionOverwrites.map((o) => ({
                  id: o.id,
                  allow: o.allow,
                  deny: o.deny,
                  type: o.type,
                })),
                topic: channel.topic,
                rtcRegion: channel.rtcRegion,
                userLimit: channel.userLimit,
              })
              .catch((e) =>
                logger.warn(
                  `[ANTI-CHANNEL] Impossible de recréer le salon: ${e.message}`,
                ),
              );
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-CHANNEL] Erreur: ${err.message}`, err);
    }
  },
};
