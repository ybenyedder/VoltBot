const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "roleUpdate",
  async execute(oldRole, newRole, client) {
    if (!newRole.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await newRole.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleUpdate,
      });
      const log = fetchedLogs.entries.first();

      let executor = null;
      if (log && Date.now() - log.createdTimestamp < 30000) {
        executor = log.executor;
      }

      // --- LOGGING ---
      const gs = client.db.getGuild(oldRole.guild.id);
      const lang = gs.language || "fr";
      const logChannelId =
        client.db.resolveLogChannel(oldRole.guild.id, "rolelog", "update") ||
        client.db.resolveLogChannel(oldRole.guild.id, "raidlog", "update") ||
        client.db.resolveLogChannel(oldRole.guild.id, "modlog", "update");
      if (logChannelId) {
        const channel = oldRole.guild.channels.cache.get(logChannelId);
        if (channel) {
          const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;
          const diffs = [];
          if (oldRole.name !== newRole.name)
            diffs.push(
              t(lang, "events.roleUpdate.diff_name", {
                old: oldRole.name,
                new: newRole.name,
              }),
            );
          if (oldRole.color !== newRole.color)
            diffs.push(
              t(lang, "events.roleUpdate.diff_color", {
                old: hex(oldRole.color),
                new: hex(newRole.color),
              }),
            );
          if (oldRole.permissions.bitfield !== newRole.permissions.bitfield)
            diffs.push(t(lang, "events.roleUpdate.diff_permissions"));
          if (oldRole.hoist !== newRole.hoist)
            diffs.push(
              t(lang, "events.roleUpdate.diff_hoist", {
                old: oldRole.hoist,
                new: newRole.hoist,
              }),
            );
          if (oldRole.mentionable !== newRole.mentionable)
            diffs.push(
              t(lang, "events.roleUpdate.diff_mention", {
                old: oldRole.mentionable,
                new: newRole.mentionable,
              }),
            );

          if (diffs.length === 0) return;

          const embed = client.embedBuilder
            .base(client, t(lang, "events.roleUpdate.title"))
            .addFields(
              {
                name: t(lang, "events.roleUpdate.field_role"),
                value: `<@&${newRole.id}>`,
                inline: true,
              },
              {
                name: t(lang, "events.roleUpdate.field_color"),
                value: `\`${hex(newRole.color)}\``,
                inline: true,
              },
              {
                name: t(lang, "events.roleUpdate.field_executor"),
                value: executor
                  ? `<@${executor.id}>`
                  : t(lang, "events.roleUpdate.unknown"),
                inline: true,
              },
              {
                name: t(lang, "events.roleUpdate.field_changes"),
                value: `\`\`\`diff\n${diffs.join("\n").substring(0, 1000)}\n\`\`\``,
                inline: false,
              },
            );
          await channel
            .send({ embeds: [embed] })
            .catch((err) =>
              logger.error(
                `[ROLE_UPDATE] Failed to send log embed to channel ${logChannelId}: ${err.message}`,
              ),
            );
        }
      }

      // --- ANTIRAID PROTECTION ---
      const config = client.db.getAntiraidConfig(newRole.guild.id);
      if (
        config &&
        config.antiRole > 0 &&
        executor &&
        executor.id !== client.user.id
      ) {
        if (
          !require("../utils/permissions").isWhitelisted(
            executor.id,
            newRole.guild.id,
            client,
            gs,
            "antiRole",
          )
        ) {
          const member = await newRole.guild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              "antiRole",
              t(lang, "events.roleUpdate.reason_unauthorized"),
              client,
            );
            logger.event(
              `[ANTI-ROLE] ${executor.tag} sanctionné — modification de rôle : ${actionResult}`,
            );
            if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
              await newRole
                .setPermissions(oldRole.permissions.bitfield)
                .catch((err) =>
                  logger.warn(
                    `[ANTI-ROLE] Failed to revert permissions for role ${newRole.id}: ${err.message}`,
                  ),
                );
            }
            if (oldRole.name !== newRole.name) {
              await newRole
                .setName(oldRole.name)
                .catch((err) =>
                  logger.warn(
                    `[ANTI-ROLE] Failed to revert name for role ${newRole.id}: ${err.message}`,
                  ),
                );
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-ROLE] Erreur: ${err.message}`, err);
    }
  },
};
