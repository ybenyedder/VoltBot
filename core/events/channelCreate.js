const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "channelCreate",
  async execute(channel, client) {
    if (!channel.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelCreate,
      });
      const log = fetchedLogs.entries.first();

      let executor = null;
      if (log && Date.now() - log.createdTimestamp < 30000) {
        executor = log.executor;
      }

      // --- LOGGING (ALWAYS) ---
      const gs = client.db.getGuild(channel.guild.id);
      const lang = gs.language || "fr";
      const logChannelId =
        client.db.resolveLogChannel(channel.guild.id, "channellog", "create") ||
        client.db.resolveLogChannel(channel.guild.id, "raidlog", "create") ||
        client.db.resolveLogChannel(channel.guild.id, "modlog", "create");
      if (logChannelId) {
        const channelObj = channel.guild.channels.cache.get(logChannelId);
        if (channelObj) {
          const createdTs = Math.floor(channel.createdTimestamp / 1000);
          const embed = client.embedBuilder
            .base(client, t(lang, "events.channelCreate.title"))
            .addFields(
              {
                name: t(lang, "events.channelCreate.field_channel"),
                value: `<#${channel.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.channelCreate.field_type"),
                value: `\`${channel.type}\``,
                inline: true,
              },
              {
                name: t(lang, "events.channelCreate.field_executor"),
                value: executor
                  ? `<@${executor.id}>`
                  : t(lang, "events.channelCreate.unknown"),
                inline: true,
              },
              {
                name: t(lang, "events.channelCreate.field_created"),
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
          const member = await channel.guild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              "antiChannel",
              t(lang, "events.channelCreate.sanction_reason"),
              client,
            );
            logger.event(
              `[ANTIRAID] ${executor.tag} sanctionné via antiChannel : ${actionResult}`,
            );
            await channel.delete().catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-CHANNEL] Erreur: ${err.message}`, err);
    }
  },
};
