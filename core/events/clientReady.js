const { ActivityType, Events } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

// Mappe la valeur texte stockée dans `bot_settings.activityType` vers l'enum
// Discord. Fallback sur Custom si valeur absente ou inconnue.
const TYPE_MAP = {
  Playing: ActivityType.Playing,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
  Custom: ActivityType.Custom,
};

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(
      `Connecté ${client.user.tag} | ${client.guilds.cache.size} serveurs | ${client.users.cache.size} utilisateurs | ${client.commands.size} commandes.`,
    );

    // --- BOT PRESENCE INITIALIZATION & AUTO-REFRESH ---
    const updatePresence = () => {
      try {
        const settings = client.db.getBotSettings();
        // Fallback: Si pas de settings, mettre en 'dnd' (Do Not Disturb) au lieu de offline
        const status = settings?.presenceStatus || "dnd";
        const customStatus = settings?.customStatus || "Aegis Security";
        const activityType =
          TYPE_MAP[settings?.activityType] ?? ActivityType.Custom;

        client.user.setPresence({
          status: status,
          activities: [{ name: customStatus, type: activityType }],
        });
      } catch (e) {
        logger.error(
          "[READY] Erreur lors de l'application de la présence :",
          e,
        );
      }
    };

    updatePresence();
    if (!client._readyIntervals) client._readyIntervals = [];
    client._readyIntervals.push(setInterval(updatePresence, 600000)); // 10 minutes

    // Vérification des anniversaires tous les jours à une certaine heure (ou toutes les heures de façon simplifiée)
    // Ici on check toutes les heures si la date a changé (très simpliste, en production on utiliserait node-cron)
    // NOTE: comparaisons en UTC pour rester indépendant du fuseau horaire du serveur.
    // Le déclenchement à 08:00 UTC garantit un comportement reproductible quel que soit le TZ système.
    let lastCheckedDay = -1;
    client._readyIntervals.push(setInterval(() => {
      const date = new Date();
      if (date.getUTCHours() === 8 && date.getUTCDate() !== lastCheckedDay) {
        lastCheckedDay = date.getUTCDate();
        const currentMonth = date.getUTCMonth() + 1;
        const currentDay = date.getUTCDate();

        const bdays = client.db.getBirthdays(currentDay, currentMonth);
        if (bdays) {
          bdays.forEach(async (bday) => {
            const guild = client.guilds.cache.get(bday.guildId);
            if (!guild) return;
            const guildSettings = client.db.getGuild(bday.guildId);
            // Utiliser birthdayChannel dédié en priorité, sinon welcomeChannel
            const bdayChannelId =
              guildSettings.birthdayChannel || guildSettings.welcomeChannel;
            if (!bdayChannelId) return;
            const channel = guild.channels.cache.get(bdayChannelId);
            if (channel) {
              const lang = guildSettings.language || "fr";
              channel
                .send(
                  t(lang, "events.clientReady.birthday_message", {
                    user: `<@${bday.userId}>`,
                  }),
                )
                .catch(() => {});
            }
          });
        }
      }
    }, 3600000)); // 1 heure
    // --- GIVEAWAYS CHECKER ---
    client._readyIntervals.push(setInterval(async () => {
      const giveawayUtils = require("../utils/giveaways");
      const gws = client.db.getActiveGiveaways();
      const now = Date.now();

      for (const gw of gws) {
        // Vérifier si le giveaway est terminé
        if (gw.endsAt > now) continue;

        const result = await giveawayUtils
          .endGiveaway(client, gw.messageId)
          .catch((error) => ({ ok: false, error }));
        if (!result.ok && result.error) {
          client.logger.error(
            `[GIVEAWAY] Error ending giveaway ${gw.messageId}: ${result.error.message}`,
          );
        }
      }
    }, 10000)); // Check toutes les 10 secondes

    // --- STATS CHANNELS AUTO-REFRESH ---
    try {
      const { startStatsRefresh } = require("../commands/config/serverstats");
      const allStats = client.db.getStatsChannels();
      for (const row of allStats) {
        const guild = client.guilds.cache.get(row.guildId);
        if (guild) startStatsRefresh(client, guild);
      }
      if (allStats.length > 0)
        logger.info(`Stats refresh activé pour ${allStats.length} serveur(s).`);
    } catch (e) {
      logger.error("[READY] Erreur initialisation stats :", e);
    }

    // --- GARBAGE COLLECTION: Nettoyage des Maps en mémoire toutes les 5 minutes ---
    client._readyIntervals.push(setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      // Purger l'anti-spam (entrées > 30 secondes)
      if (client.spamMap) {
        const initialSize = client.spamMap.size;
        for (const [userId, data] of client.spamMap) {
          if (now - data.lastMessage > 30000) {
            client.spamMap.delete(userId);
            cleanedCount++;
          }
        }
        if (client.spamMap.size !== initialSize) {
          logger.debug(
            `[CLEANUP] SpamMap: ${initialSize} -> ${client.spamMap.size} (nettoyé: ${initialSize - client.spamMap.size})`,
          );
        }
      }

      // Purger les compteurs anti-nuke (entrées > 2 minutes)
      if (client.nukeCounters) {
        const initialSize = client.nukeCounters.size;
        for (const [key, data] of client.nukeCounters) {
          if (now - data.firstAction > 120000) {
            client.nukeCounters.delete(key);
            cleanedCount++;
          }
        }
        if (client.nukeCounters.size !== initialSize) {
          logger.debug(
            `[CLEANUP] NukeCounters: ${initialSize} -> ${client.nukeCounters.size} (nettoyé: ${initialSize - client.nukeCounters.size})`,
          );
        }
      }

      // Purger les cooldowns des drops (entrées > 5 minutes)
      if (client.dropCooldowns) {
        const initialSize = client.dropCooldowns.size;
        for (const [channelId, timestamp] of client.dropCooldowns) {
          if (now - timestamp > 300000) {
            client.dropCooldowns.delete(channelId);
            cleanedCount++;
          }
        }
        if (client.dropCooldowns.size !== initialSize) {
          logger.debug(
            `[CLEANUP] DropCooldowns: ${initialSize} -> ${client.dropCooldowns.size} (nettoyé: ${initialSize - client.dropCooldowns.size})`,
          );
        }
      }

      // Purger les cooldowns des lettres anonymes (entrées > 5 minutes)
      if (client.lettresCooldown) {
        const initialSize = client.lettresCooldown.size;
        for (const [userId, timestamp] of client.lettresCooldown) {
          if (now - timestamp > 300000) {
            client.lettresCooldown.delete(userId);
            cleanedCount++;
          }
        }
        if (client.lettresCooldown.size !== initialSize) {
          logger.debug(
            `[CLEANUP] LettresCooldown: ${initialSize} -> ${client.lettresCooldown.size} (nettoyé: ${initialSize - client.lettresCooldown.size})`,
          );
        }
      }

      // Purger les états de lettres anonymes abandonnés (entrées > 10 minutes)
      if (client.lettresState) {
        const initialSize = client.lettresState.size;
        for (const [userId, state] of client.lettresState) {
          if (!state._createdAt) state._createdAt = now;
          if (now - state._createdAt > 600000) {
            client.lettresState.delete(userId);
            cleanedCount++;
          }
        }
        if (client.lettresState.size !== initialSize) {
          logger.debug(
            `[CLEANUP] LettresState: ${initialSize} -> ${client.lettresState.size} (nettoyé: ${initialSize - client.lettresState.size})`,
          );
        }
      }

      // Purger les états de ticket options abandonnés (entrées > 10 minutes)
      if (client.ticketOptionState) {
        const initialSize = client.ticketOptionState.size;
        for (const [userId, state] of client.ticketOptionState) {
          if (!state._createdAt) state._createdAt = now;
          if (now - state._createdAt > 600000) {
            client.ticketOptionState.delete(userId);
            cleanedCount++;
          }
        }
        if (client.ticketOptionState.size !== initialSize) {
          logger.debug(
            `[CLEANUP] TicketOptionState: ${initialSize} -> ${client.ticketOptionState.size} (nettoyé: ${initialSize - client.ticketOptionState.size})`,
          );
        }
      }

      // Purger le cache de stats update (entrées > 10 minutes)
      if (client.statsUpdateQueue) {
        const initialSize = client.statsUpdateQueue.size;
        for (const [channelId, timestamp] of client.statsUpdateQueue) {
          if (now - timestamp > 600000) {
            client.statsUpdateQueue.delete(channelId);
            cleanedCount++;
          }
        }
        if (client.statsUpdateQueue.size !== initialSize) {
          logger.debug(
            `[CLEANUP] StatsUpdateQueue: ${initialSize} -> ${client.statsUpdateQueue.size} (nettoyé: ${initialSize - client.statsUpdateQueue.size})`,
          );
        }
      }

      // Purger les snipes (entrées > 1 heure)
      if (client.snipes) {
        const initialSize = client.snipes.size;
        for (const [channelId, data] of client.snipes) {
          if (now - data.timestamp > 3600000) {
            client.snipes.delete(channelId);
            cleanedCount++;
          }
        }
        if (client.snipes.size !== initialSize) {
          logger.debug(
            `[CLEANUP] Snipes: ${initialSize} -> ${client.snipes.size} (nettoyé: ${initialSize - client.snipes.size})`,
          );
        }
      }

      // Purger les editSnipes (entrées > 1 heure)
      if (client.editSnipes) {
        const initialSize = client.editSnipes.size;
        for (const [channelId, data] of client.editSnipes) {
          if (now - data.timestamp > 3600000) {
            client.editSnipes.delete(channelId);
            cleanedCount++;
          }
        }
        if (client.editSnipes.size !== initialSize) {
          logger.debug(
            `[CLEANUP] EditSnipes: ${initialSize} -> ${client.editSnipes.size} (nettoyé: ${initialSize - client.editSnipes.size})`,
          );
        }
      }

      if (cleanedCount > 0) {
        logger.info(
          `[CLEANUP] Nettoyé ${cleanedCount} entrées mémoire expirées`,
        );
      }
    }, 300000)); // 5 minutes
    logger.info(
      "Garbage collection des Maps mémoire initialisé (toutes les 5 min).",
    );

    // Initialisation des snipers d'URL personnalisée (Vanity)
    try {
      const vanitySniper = require("../utils/vanitySniper");
      vanitySniper.init(client);
    } catch (e) {
      logger.error("[READY] Erreur lors de l'initialisation du vanity sniper :", e);
    }
  },
};
