const {
  PermissionsBitField,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const logger = require("../../utils/logger");

module.exports = {
  name: "serverstats",
  aliases: ["setupstats", "statschannel"],
  description:
    "Cree une categorie Statistiques avec des compteurs en temps reel.",
  category: "config",
  usage: "+serverstats [invite code]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const guildSettings = client.db.getGuild(message.guild.id) || {};

    // --- Sous-commande FORMAT ---
    if (args[0] === "format") {
      const newFormat = args.slice(1).join("");
      const currentFmt = guildSettings.statsFormat || "・{emoji}・{name} :";
      if (!newFormat) {
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .info(client, message.t("commands.serverstats.current_format"))
                .addFields(
                  {
                    name: message.t("commands.serverstats.field_format"),
                    value: `\`${currentFmt}\``,
                    inline: false,
                  },
                  {
                    name: message.t("commands.serverstats.field_variables"),
                    value: "`{emoji}`, `{name}`",
                    inline: true,
                  },
                ),
            ],
          })
          .catch(() => {});
      }

      client.db.updateGuild(message.guild.id, { statsFormat: newFormat });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(client, message.t("commands.serverstats.format_updated")).addFields(
              { name: message.t("commands.serverstats.field_before"), value: `\`${currentFmt}\``, inline: true },
              { name: message.t("commands.serverstats.field_after"), value: `\`${newFormat}\``, inline: true },
              {
                name: message.t("commands.serverstats.field_effect"),
                value: message.t("commands.serverstats.next_refresh"),
                inline: true,
              },
            ),
          ],
        })
        .catch(() => {});
    }

    const inviteCode = args[0] || null;

    const progress = await message
      .reply({
        embeds: [client.embedBuilder.info(client, message.t("commands.serverstats.creating_category"))],
      })
      .catch(() => {});

    try {
      // --- Créer la catégorie ---
      const category = await message.guild.channels.create({
        name: "Statistiques",
        type: ChannelType.GuildCategory,
        position: 0,
        permissionOverwrites: [
          {
            id: message.guild.id,
            deny: [PermissionFlagsBits.Connect],
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      // --- Données initiales ---
      const totalMembers = message.guild.memberCount;
      const onlineMembers = message.guild.members.cache.filter(
        (m) =>
          m.presence?.status && m.presence.status !== "offline" && !m.user.bot,
      ).size;
      const vocalMembers = message.guild.members.cache.filter(
        (m) => m.voice.channelId,
      ).size;

      // Top XP member
      let topName = "Aucun";
      try {
        const topUser = client.db.getCustomCommand
          ? client.db.db
              .prepare(
                "SELECT userId, xp FROM users WHERE guildId = ? ORDER BY xp DESC LIMIT 1",
              )
              .get(message.guild.id)
          : null;
        if (topUser) {
          const member = message.guild.members.cache.get(topUser.userId);
          topName = member ? member.user.username : "Inconnu";
        }
      } catch (e) {
        client.logger.warn(
          `[SERVERSTATS] Error fetching top user XP: ${e.message}`,
        );
      }

      // --- Nouveau format dynamique ---
      const format = guildSettings.statsFormat || "・{emoji}・{name} :";

      const formatName = (emoji, name, value) => {
        return `${format.replace("{emoji}", emoji).replace("{name}", name)}${value}`;
      };

      const channelsData = [
        {
          name: formatName("", "Membres", totalMembers.toLocaleString("fr-FR")),
          key: "members",
        },
        { name: formatName("", "Top 1", topName), key: "top" },
        {
          name: formatName(
            "",
            "En ligne",
            onlineMembers.toLocaleString("fr-FR"),
          ),
          key: "online",
        },
        { name: formatName("", "Vocal", vocalMembers), key: "vocal" },
      ];

      if (inviteCode) {
        channelsData.push({
          name: formatName("", ".gg/", inviteCode),
          key: "invite",
        });
      }

      const createdChannels = {};
      const start = Date.now();

      for (let idx = 0; idx < channelsData.length; idx++) {
        const ch = channelsData[idx];
        const vc = await message.guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: message.guild.id,
              deny: [PermissionFlagsBits.Connect],
              allow: [PermissionFlagsBits.ViewChannel],
            },
          ],
        });
        createdChannels[ch.key] = vc.id;

        if (progress) {
          await progress
            .edit({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.serverstats.creating_progress", { done: idx + 1, total: channelsData.length }),
                ),
              ],
            })
            .catch(() => {});
        }
      }

      // Sauvegarder en DB via les nouvelles méthodes centralisées
      client.db.saveStatsConfig(message.guild.id, {
        categoryId: category.id,
        membersId: createdChannels.members || null,
        topId: createdChannels.top || null,
        onlineId: createdChannels.online || null,
        vocalId: createdChannels.vocal || null,
        inviteId: createdChannels.invite || null,
        inviteCode: inviteCode || null,
      });

      // --- Démarrer le refresh automatique ---
      startStatsRefresh(client, message.guild);

      const durMs = Date.now() - start;
      const durStr =
        durMs < 60000
          ? `${Math.round(durMs / 1000)} s`
          : `${Math.floor(durMs / 60000)} min`;

      const done = {
        embeds: [
          client.embedBuilder
            .success(client, message.t("commands.serverstats.category_created"))
            .addFields(
              {
                name: message.t("commands.serverstats.field_category"),
                value: `<#${category.id}>`,
                inline: true,
              },
              {
                name: message.t("commands.serverstats.field_channels"),
                value: `**${channelsData.length}**`,
                inline: true,
              },
              { name: message.t("commands.serverstats.field_duration"), value: durStr, inline: true },
              {
                name: message.t("commands.serverstats.field_refresh"),
                value: "5 min",
                inline: true,
              },
            ),
        ],
      };
      if (progress) await progress.edit(done).catch(() => {});
      else await message.channel.send(done).catch(() => {});
    } catch (e) {
      logger.error("[STATS] Erreur création :", e);
      const err = {
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.serverstats.creation_error"),
          ),
        ],
      };
      if (progress) await progress.edit(err).catch(() => {});
      else await message.channel.send(err).catch(() => {});
    }
  },
};

// Utilitaire pour eviter les rate limits
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//  Auto-refresh function avec protection Rate Limit

function startStatsRefresh(client, guild) {
  // Eviter les doublons
  if (!client.statsIntervals) client.statsIntervals = new Map();
  if (client.statsIntervals.has(guild.id)) {
    clearInterval(client.statsIntervals.get(guild.id));
  }

  // Queue de mise a jour pour eviter les rate limits
  if (!client.statsUpdateQueue) client.statsUpdateQueue = new Map();

  const refresh = async () => {
    try {
      const config = client.db.getStatsConfig(guild.id);
      if (!config) return;

      // Fetch les membres pour avoir des donnees a jour
      await guild.members.fetch().catch(() => {});

      const totalMembers = guild.memberCount;
      const onlineMembers = guild.members.cache.filter(
        (m) =>
          m.presence?.status && m.presence.status !== "offline" && !m.user.bot,
      ).size;
      const vocalMembers = guild.members.cache.filter(
        (m) => m.voice.channelId,
      ).size;

      // Top XP
      let topName = "Aucun";
      try {
        const topUser = client.db.db
          .prepare(
            "SELECT userId, xp FROM users WHERE guildId = ? ORDER BY xp DESC LIMIT 1",
          )
          .get(guild.id);
        if (topUser) {
          const member = guild.members.cache.get(topUser.userId);
          topName = member ? member.user.username : "Inconnu";
        }
      } catch (e) {
        client.logger.warn(
          `[SERVERSTATS] Error fetching top user XP during refresh: ${e.message}`,
        );
      }

      // Nouveau format dynamique
      const guildSettings = client.db.getGuild(guild.id) || {};
      const globalFormat = guildSettings.statsFormat || "・{emoji}・{name} :";

      const getFormattedName = (key, emoji, name, value) => {
        const dbKey = `stats${key.charAt(0).toUpperCase() + key.slice(1)}Format`;
        const specificFormat = guildSettings[dbKey];
        const format = specificFormat || globalFormat;
        return `${format.replace("{emoji}", emoji).replace("{name}", name)}${value}`;
      };

      const updates = [
        {
          id: config.membersId,
          name: getFormattedName(
            "members",
            "",
            "Membres",
            totalMembers.toLocaleString("fr-FR"),
          ),
        },
        {
          id: config.topId,
          name: getFormattedName("top", "", "Top 1", topName),
        },
        {
          id: config.onlineId,
          name: getFormattedName(
            "online",
            "",
            "En ligne",
            onlineMembers.toLocaleString("fr-FR"),
          ),
        },
        {
          id: config.vocalId,
          name: getFormattedName("vocal", "", "Vocal", vocalMembers),
        },
      ];

      // Mettre a jour les noms des channels avec delai entre chaque pour eviter Rate Limit
      // Discord limite le renommage de channels a 2 fois par 10 minutes par channel
      for (const u of updates) {
        if (!u.id) continue;
        const ch = guild.channels.cache.get(u.id);
        if (ch && ch.name !== u.name) {
          // Verifier si on a deja mis a jour ce channel recemment
          const lastUpdate = client.statsUpdateQueue.get(ch.id) || 0;
          const now = Date.now();

          // Discord rate limit: 2 updates per 10 minutes per channel
          // On attend au moins 5 minutes et 10 secondes entre chaque mise a jour pour être sûr de passer la limite glissante de 10 minutes
          if (now - lastUpdate < 310000) {
            continue; // Skip this update, too recent
          }

          try {
            await ch.setName(u.name);
            client.statsUpdateQueue.set(ch.id, now);
            // Attendre 2 secondes entre chaque mise a jour de channel
            await sleep(2000);
          } catch (err) {
            if (err.code === 50013) {
              logger.warn(
                `[STATS] Permission manquante pour renommer ${ch.name}`,
              );
            } else if (err.code === 429) {
              logger.warn(
                `[STATS] Rate limit atteint pour ${ch.name}, skip... et on attend un peu plus`,
              );
              client.statsUpdateQueue.set(ch.id, now + 600000); // Bloquer pour 10 min de plus
            }
          }
        }
      }
    } catch (e) {
      logger.error("[STATS] Erreur refresh:", e.message);
    }
  };

  // Premier refresh apres 10 secondes, puis toutes les 6 minutes
  setTimeout(refresh, 10000);
  const interval = setInterval(refresh, 360000); // 6 minutes (plus sûr pour le rate limit de 10 min)
  client.statsIntervals.set(guild.id, interval);
}

// Export le refresh pour l'appeler au demarrage
module.exports.startStatsRefresh = startStatsRefresh;
