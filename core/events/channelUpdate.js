const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "channelUpdate",
  async execute(oldChannel, newChannel, client) {
    if (!newChannel.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await newChannel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelUpdate,
      });
      const log = fetchedLogs.entries.first();

      let executor = null;
      if (log && Date.now() - log.createdTimestamp < 30000) {
        executor = log.executor;
      }

      // --- LOGGING ---
      const gs = client.db.getGuild(oldChannel.guild.id);
      const lang = gs.language || "fr";
      const logChannelId =
        client.db.resolveLogChannel(oldChannel.guild.id, "channellog", "update") ||
        client.db.resolveLogChannel(oldChannel.guild.id, "raidlog", "update") ||
        client.db.resolveLogChannel(oldChannel.guild.id, "modlog", "update");

      const nameChanged = oldChannel.name !== newChannel.name;
      const topicChanged =
        (oldChannel.topic || "") !== (newChannel.topic || "");
      const oldPermsCount = oldChannel.permissionOverwrites?.cache?.size ?? 0;
      const newPermsCount = newChannel.permissionOverwrites?.cache?.size ?? 0;
      let permsChanged = oldPermsCount !== newPermsCount;
      if (!permsChanged && oldChannel.permissionOverwrites?.cache) {
        for (const [id, oldOv] of oldChannel.permissionOverwrites.cache) {
          const newOv = newChannel.permissionOverwrites.cache.get(id);
          if (
            !newOv ||
            oldOv.allow.bitfield !== newOv.allow.bitfield ||
            oldOv.deny.bitfield !== newOv.deny.bitfield
          ) {
            permsChanged = true;
            break;
          }
        }
      }

      if (logChannelId && (nameChanged || topicChanged || permsChanged)) {
        const channelObj = oldChannel.guild.channels.cache.get(logChannelId);
        if (channelObj) {
          const createdTs = Math.floor(newChannel.createdTimestamp / 1000);
          const embed = client.embedBuilder
            .base(client, t(lang, "events.channelUpdate.title"))
            .addFields(
              {
                name: t(lang, "events.channelUpdate.field_channel"),
                value: `<#${newChannel.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.channelUpdate.field_type"),
                value: `\`${newChannel.type}\``,
                inline: true,
              },
              {
                name: t(lang, "events.channelUpdate.field_executor"),
                value: executor
                  ? `<@${executor.id}>`
                  : t(lang, "events.channelUpdate.unknown"),
                inline: true,
              },
              {
                name: t(lang, "events.channelUpdate.field_created"),
                value: `<t:${createdTs}:R>`,
                inline: true,
              },
            );

          const diffs = [];
          if (nameChanged)
            diffs.push(
              t(lang, "events.channelUpdate.diff_name", {
                old: oldChannel.name,
                new: newChannel.name,
              }),
            );
          if (topicChanged) {
            const oldT =
              (oldChannel.topic || "").substring(0, 200) ||
              t(lang, "events.channelUpdate.empty");
            const newT =
              (newChannel.topic || "").substring(0, 200) ||
              t(lang, "events.channelUpdate.empty");
            diffs.push(
              t(lang, "events.channelUpdate.diff_topic", {
                old: oldT,
                new: newT,
              }),
            );
          }
          if (permsChanged)
            diffs.push(t(lang, "events.channelUpdate.diff_perms"));
          if (diffs.length > 0) {
            embed.addFields({
              name: t(lang, "events.channelUpdate.field_changes"),
              value: `\`\`\`diff\n${diffs.join("\n").substring(0, 1000)}\n\`\`\``,
              inline: false,
            });
          }
          await channelObj.send({ embeds: [embed] }).catch(() => {});
        }
      }

      // --- ANTIRAID PROTECTION ---
      const config = client.db.getAntiraidConfig(newChannel.guild.id);
      if (
        config &&
        config.antiChannel > 0 &&
        executor &&
        executor.id !== client.user.id
      ) {
        if (
          !require("../utils/permissions").isWhitelisted(
            executor.id,
            newChannel.guild.id,
            client,
            gs,
            "antiChannel",
          )
        ) {
          const member = await newChannel.guild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              "antiChannel",
              t(lang, "events.channelUpdate.reason_unauthorized"),
              client,
            );
            logger.event(
              `[ANTI-CHANNEL] ${executor.tag} sanctionné — modification de salon : ${actionResult}`,
            );
            if (oldChannel.name !== newChannel.name) {
              await newChannel.setName(oldChannel.name).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-CHANNEL] Erreur: ${err.message}`, err);
    }
  },
};
