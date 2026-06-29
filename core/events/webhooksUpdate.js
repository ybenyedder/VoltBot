const { AuditLogEvent, Events } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: Events.WebhooksUpdate,
  async execute(channel, client) {
    if (!channel.guild) return;

    const config = client.db.getAntiraidConfig(channel.guild.id);
    if (!config || !(config.antiWebhook > 0)) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      // Fetch audit logs for Webhook actions
      let fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.WebhookCreate,
      });
      let log = fetchedLogs.entries.first();

      // If no valid Create log within the last 30 seconds, try checking Update
      if (!log || Date.now() - log.createdTimestamp > 30000) {
        fetchedLogs = await channel.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.WebhookUpdate,
        });
        log = fetchedLogs.entries.first();
      }

      if (!log) {
        logger.warn("[ANTI-WEBHOOK] Pas d'entrée audit log trouvée.");
        return;
      }

      const { executor, target } = log;
      if (!executor || executor.id === client.user.id) return;

      const perms = require("../utils/permissions");
      if (
        perms.isWhitelisted(
          executor.id,
          channel.guild.id,
          client,
          null,
          "antiNuke",
        )
      )
        return;

      // Vérifier que l'action est récente (< 30 sec)
      if (Date.now() - log.createdTimestamp > 30000) return;

      const member = await channel.guild.members
        .fetch(executor.id)
        .catch(() => null);
      if (!member) {
        logger.warn(`[ANTI-WEBHOOK] Membre ${executor.tag} introuvable.`);
        return;
      }

      const gs = client.db.getGuild(channel.guild.id);
      const lang = gs.language || "fr";

      const actionResult = await client.utils.antiraid.processSanction(
        member,
        "antiWebhook",
        t(lang, "events.webhooksUpdate.reason"),
        client,
      );
      logger.event(
        `[ANTIRAID] ${executor.tag} sanctionné via antiWebhook : ${actionResult}`,
      );

      // Supprimer le webhook en ciblant directement l'id du log
      if (target && target.id) {
        try {
          const wh = await client.fetchWebhook(target.id);
          if (wh)
            await wh
              .delete("Anti-Webhook")
              .catch((err) =>
                logger.error(
                  `[ANTI-WEBHOOK] Failed to delete webhook ${target.id}: ${err.message}`,
                ),
              );
        } catch (e) {
          logger.warn(
            `[ANTI-WEBHOOK] Impossible de supprimer le webhook ${target.id}: ${e.message}`,
          );
        }
      }
      // Logging
      const logChannelId =
        client.db.resolveLogChannel(channel.guild.id, "raidlog", "webhook") ||
        client.db.resolveLogChannel(channel.guild.id, "modlog", "webhook");
      if (logChannelId) {
        const logChannel = channel.guild.channels.cache.get(logChannelId);
        if (logChannel) {
          const embed = client.embedBuilder
            .base(client, t(lang, "events.webhooksUpdate.title"))
            .addFields(
              {
                name: t(lang, "events.webhooksUpdate.field_channel"),
                value: `<#${channel.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.webhooksUpdate.field_executor"),
                value: `<@${executor.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.webhooksUpdate.field_action"),
                value: t(lang, "events.webhooksUpdate.action_value"),
                inline: false,
              },
            );
          await logChannel
            .send({ embeds: [embed] })
            .catch((err) =>
              logger.error(
                `[ANTI-WEBHOOK] Failed to send log message to channel ${logChannelId}: ${err.message}`,
              ),
            );
        }
      }
    } catch (err) {
      logger.error(`[ANTI-WEBHOOK] Erreur: ${err.message}`, err);
    }
  },
};
