const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "roleDelete",
  async execute(role, client) {
    if (!role.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await role.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleDelete,
      });
      const log = fetchedLogs.entries.first();

      let executor = null;
      if (log && Date.now() - log.createdTimestamp < 30000) {
        executor = log.executor;
      }

      // --- LOGGING ---
      const gs = client.db.getGuild(role.guild.id);
      const lang = gs.language || "fr";
      const logChannelId =
        client.db.resolveLogChannel(role.guild.id, "rolelog", "delete") ||
        client.db.resolveLogChannel(role.guild.id, "raidlog", "delete") ||
        client.db.resolveLogChannel(role.guild.id, "modlog", "delete");
      if (logChannelId) {
        const channel = role.guild.channels.cache.get(logChannelId);
        if (channel) {
          const embed = client.embedBuilder
            .base(client, t(lang, "events.roleDelete.title"))
            .addFields(
              {
                name: t(lang, "events.roleDelete.field_role"),
                value: `\`${role.name}\``,
                inline: true,
              },
              {
                name: t(lang, "events.roleDelete.field_color"),
                value: role.color
                  ? `\`#${role.color.toString(16).padStart(6, "0")}\``
                  : `\`${t(lang, "events.roleDelete.color_none")}\``,
                inline: true,
              },
              {
                name: t(lang, "events.roleDelete.field_executor"),
                value: executor
                  ? `<@${executor.id}>`
                  : t(lang, "events.roleDelete.unknown"),
                inline: true,
              },
            );
          await channel
            .send({ embeds: [embed] })
            .catch((err) =>
              logger.error(
                `[ROLE_DELETE] Failed to send log embed to channel ${logChannelId}: ${err.message}`,
              ),
            );
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
          // Anti-Nuke counter
          if (!client.nukeCounters) client.nukeCounters = new Map();
          const nukeKey = `${executor.id}_roles`;
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

          const nukeLimit = config.nukeRoleLimit || 3;
          const isNuke = config.antiNuke > 0 && userData.count >= nukeLimit;

          const member = await role.guild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              "antiRole",
              t(lang, "events.roleDelete.reason_unauthorized"),
              client,
            );
            logger.event(
              `[ANTI-ROLE] ${executor.tag} sanctionné — suppression de rôle : ${actionResult}`,
            );

            // Recréer le rôle supprimé
            await role.guild.roles
              .create({
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                permissions: role.permissions.bitfield,
                position: role.position,
                mentionable: role.mentionable,
                reason: t(lang, "events.roleDelete.reason_recreate"),
              })
              .catch((e) =>
                logger.warn(
                  `[ANTI-ROLE] Impossible de recréer le rôle: ${e.message}`,
                ),
              );
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-ROLE] Erreur: ${err.message}`, err);
    }
  },
};
