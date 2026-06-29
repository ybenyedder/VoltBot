const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "roleCreate",
  async execute(role, client) {
    if (!role.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await role.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleCreate,
      });
      const log = fetchedLogs.entries.first();

      let executor = null;
      if (log && Date.now() - log.createdTimestamp < 30000) {
        executor = log.executor;
      }

      // --- LOGGING ---
      const gs = client.db.getGuild(role.guild.id);
      const lang = (gs && gs.language) || "fr";
      const logChannelId =
        client.db.resolveLogChannel(role.guild.id, "rolelog", "create") ||
        client.db.resolveLogChannel(role.guild.id, "raidlog", "create") ||
        client.db.resolveLogChannel(role.guild.id, "modlog", "create");
      if (logChannelId) {
        const channel = role.guild.channels.cache.get(logChannelId);
        if (channel) {
          const embed = client.embedBuilder
            .base(client, t(lang, "events.roleCreate.title"))
            .addFields(
              {
                name: t(lang, "events.roleCreate.field_role"),
                value: `<@&${role.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.roleCreate.field_color"),
                value: role.color
                  ? `\`#${role.color.toString(16).padStart(6, "0")}\``
                  : `\`${t(lang, "events.roleCreate.color_none")}\``,
                inline: true,
              },
              {
                name: t(lang, "events.roleCreate.field_executor"),
                value: executor
                  ? `<@${executor.id}>`
                  : t(lang, "events.roleCreate.unknown"),
                inline: true,
              },
            );
          await channel.send({ embeds: [embed] }).catch(() => {});
        }
      }

      // --- ANTIRAID PROTECTION ---
      const config = client.db.getAntiraidConfig(role.guild.id);
      if (
        config &&
        config.antiRole > 0 &&
        executor &&
        executor.id !== client.user.id
      ) {
        if (
          !require("../utils/permissions").isWhitelisted(
            executor.id,
            role.guild.id,
            client,
            gs,
            "antiRole",
          )
        ) {
          const member = await role.guild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              "antiRole",
              t(lang, "events.roleCreate.reason_unauthorized"),
              client,
            );
            logger.event(
              `[ANTIRAID] ${executor.tag} sanctionné via antiRole : ${actionResult}`,
            );
            await role.delete().catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-ROLE] Erreur: ${err.message}`, err);
    }
  },
};
