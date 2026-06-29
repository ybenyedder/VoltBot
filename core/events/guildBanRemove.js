const { AuditLogEvent } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "guildBanRemove",
  async execute(ban, client) {
    if (!ban.guild) return;

    try {
      await new Promise((r) => setTimeout(r, 1000));
      const fetchedLogs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanRemove,
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
        client.db.resolveLogChannel(ban.guild.id, "modlog", "unban") ||
        gs.raidLogsChannel;
      if (logChannelId) {
        const channel = ban.guild.channels.cache.get(logChannelId);
        if (channel) {
          const actor = executor || {
            id: "0",
            toString: () => t(lang, "events.guildBanRemove.unknown_actor"),
          };
          const embed = client.embedBuilder.modLog(
            client,
            t(lang, "events.guildBanRemove.action"),
            ban.user,
            actor,
            t(lang, "events.guildBanRemove.reason_lift"),
            [],
            lang,
          );
          await channel
            .send({ embeds: [embed] })
            .catch((err) =>
              logger.error(
                `[GUILD_BAN_REMOVE] Failed to send mod log embed: ${err.message}`,
              ),
            );
        }
      }

      // --- ANTIRAID PROTECTION ---
      const config = client.db.getAntiraidConfig(ban.guild.id);
      if (
        config &&
        (config.antiUnban > 0 || config.antiNuke > 0) &&
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
          // Anti-Nuke counter for Unbans
          if (!client.nukeCounters) client.nukeCounters = new Map();
          const nukeKey = `${executor.id}_unbans`;
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

          const nukeLimit = config.nukeUnbanLimit || 3;
          const isNuke = config.antiNuke > 0 && userData.count >= nukeLimit;

          if (config.antiUnban > 0 || isNuke) {
            // Refaire le ban si Anti-Unban est ON ou si Nuke détecté
            await ban.guild.bans
              .create(ban.user, {
                reason: t(lang, "events.guildBanRemove.reason_antiunban_reban"),
              })
              .catch((e) => {
                logger.error(
                  `[ANTI-UNBAN] Failed to re-ban ${ban.user.tag} (${ban.user.id}): ${e.message}`,
                );
              });

            const member = await ban.guild.members
              .fetch(executor.id)
              .catch(() => null);
            if (member) {
              const moduleName = isNuke ? "antiNuke" : "antiUnban";
              const actionResult = await client.utils.antiraid.processSanction(
                member,
                moduleName,
                t(lang, "events.guildBanRemove.reason_unauthorized"),
                client,
              );
              logger.event(
                `[ANTIRAID] ${executor.tag} sanctionné via ${moduleName} : ${actionResult}`,
              );
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[ANTI-UNBAN] Erreur: ${err.message}`, err);
    }
  },
};
