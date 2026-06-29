const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "guildBanAdd",
  async execute(ban, client) {
    if (!ban.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanAdd,
      });
      const log = fetchedLogs.entries.first();

      let executor = null;
      if (log && Date.now() - log.createdTimestamp < 30000) {
        executor = log.executor;
      }

      // --- LOGGING ---
      const gs = client.db.getGuild(ban.guild.id);
      const lang = gs.language || "fr";
      const logChannelId =
        client.db.resolveLogChannel(ban.guild.id, "modlog", "ban") ||
        gs.raidLogsChannel;
      if (logChannelId) {
        const channel = ban.guild.channels.cache.get(logChannelId);
        if (channel) {
          const actor = executor || {
            id: "0",
            toString: () => t(lang, "events.guildBanAdd.unknown_actor"),
          };
          const embed = client.embedBuilder.modLog(
            client,
            t(lang, "events.guildBanAdd.action"),
            ban.user,
            actor,
            ban.reason || t(lang, "events.guildBanAdd.no_reason"),
            [],
            lang,
          );
          await channel
            .send({ embeds: [embed] })
            .catch((err) =>
              logger.error(
                `[GUILD_BAN_ADD] Failed to send mod log embed: ${err.message}`,
              ),
            );
        }
      }

      // --- ANTIRAID PROTECTION ---
      const config = client.db.getAntiraidConfig(ban.guild.id);
      if (
        config &&
        config.antiBan > 0 &&
        executor &&
        executor.id !== client.user.id
      ) {
        if (
          !require("../utils/permissions").isWhitelisted(
            executor.id,
            ban.guild.id,
            client,
            gs,
            "antiNuke",
          )
        ) {
          // Anti-Nuke counter
          if (!client.nukeCounters) client.nukeCounters = new Map();
          const nukeKey = `${executor.id}_bans`;
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

          const nukeLimit = config.nukeBanLimit || 3;
          const isNuke = config.antiNuke > 0 && userData.count >= nukeLimit;

          // Reverser le ban
          await ban.guild.bans
            .remove(ban.user, t(lang, "events.guildBanAdd.reason_antiban_revert"))
            .catch((e) => {
              logger.error(
                `[ANTI-BAN] Failed to unban ${ban.user.tag} (${ban.user.id}): ${e.message}`,
              );
            });

          const member = await ban.guild.members
            .fetch(executor.id)
            .catch(() => null);
          if (member) {
            const moduleName = isNuke ? "antiNuke" : "antiBan";
            const actionResult = await client.utils.antiraid.processSanction(
              member,
              moduleName,
              t(lang, "events.guildBanAdd.reason_unauthorized"),
              client,
            );
            logger.event(
              `[ANTIRAID] ${executor.tag} sanctionné via ${moduleName} : ${actionResult}`,
            );
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-BAN] Erreur: ${err.message}`, err);
    }
  },
};
