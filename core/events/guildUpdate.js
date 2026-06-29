const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "guildUpdate",
  async execute(oldGuild, newGuild, client) {
    if (!oldGuild || !newGuild) return;

    // 1. Anti-Edit Guild System
    const antiraid = client.db.getAntiraidConfig(newGuild.id);
    if (!antiraid || antiraid.antiEditGuild === 0) return;

    // Fetch the audit log to find who modified the guild
    try {
      const fetchedLogs = await newGuild
        .fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.GuildUpdate,
        })
        .catch(() => null);

      if (!fetchedLogs) return;

      const auditEntry = fetchedLogs.entries.first();
      if (!auditEntry) return;

      const { executor, target } = auditEntry;

      // Make sure the target is the guild and it happened recently
      if (
        target.id === newGuild.id &&
        Date.now() - auditEntry.createdTimestamp < 30000
      ) {
        // Ignore if the executor is the bot itself
        if (executor.id === client.user.id) return;

        // Check bypass
        const perms = require("../utils/permissions");
        const guildSettings = client.db.getGuild(newGuild.id);
        const lang = guildSettings?.language || "fr";
        const isWhitelisted = perms.isWhitelisted(
          executor.id,
          newGuild.id,
          client,
          guildSettings,
          "antiEditGuild",
        );

        if (!isWhitelisted) {
          logger.event(
            `[ANTI-EDIT] ${executor.tag} a tenté de modifier le serveur ${newGuild.name}.`,
          );

          // Revert changes
          await newGuild
            .edit(
              {
                name: oldGuild.name,
                icon: oldGuild.iconURL({ dynamic: true }),
                splash: oldGuild.splashURL({ dynamic: true }),
                banner: oldGuild.bannerURL({ dynamic: true }),
                afkChannel: oldGuild.afkChannelId,
                afkTimeout: oldGuild.afkTimeout,
                systemChannel: oldGuild.systemChannelId,
                verificationLevel: oldGuild.verificationLevel,
                explicitContentFilter: oldGuild.explicitContentFilter,
                defaultMessageNotifications:
                  oldGuild.defaultMessageNotifications,
                premiumProgressBarEnabled: oldGuild.premiumProgressBarEnabled,
              },
              t(lang, "events.guildUpdate.reason_anti_edit"),
            )
            .catch((err) =>
              logger.error(
                `[ANTI-EDIT] Impossible de revert les modifications: ${err.message}`,
              ),
            );

          // Apply sanction
          const member = await newGuild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              "antiEditGuild",
              t(lang, "events.guildUpdate.reason_unauthorized_edit"),
              client,
            );
            logger.event(
              `[ANTI-EDIT] ${executor.tag} sanctionné via antiEditGuild : ${actionResult}`,
            );
          }
        }
      }
    } catch (e) {
      logger.error(
        `[ANTI-EDIT] Erreur lors de la vérification de guildUpdate: ${e.message}`,
      );
    }
  },
};
