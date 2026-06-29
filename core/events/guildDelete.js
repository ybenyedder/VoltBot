const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "guildDelete",
  async execute(guild, client) {
    if (!guild) return;

    let lang = "fr";
    try {
      const gs = client.db.getGuild(guild.id);
      lang = (gs && gs.language) || "fr";
    } catch (e) {}

    logger.warn(
      `Le bot a quitté un serveur : ${guild.name || "Inconnu"} (${guild.id})`,
    );

    // Purger le cache des invitations pour ce serveur
    try {
      if (client.inviteCache && client.inviteCache[guild.id]) {
        delete client.inviteCache[guild.id];
      }
    } catch (e) {}

    // Invalider les caches de configuration runtime
    try {
      if (typeof client.invalidateGuildConfig === "function") {
        client.invalidateGuildConfig(guild.id);
      }
    } catch (e) {}

    // Notifier le propriétaire global du bot si en ligne
    try {
      const ownerIds = process.env.OWNER_ID
        ? process.env.OWNER_ID.split(",").map((id) => id.trim()).filter(Boolean)
        : [];

      if (ownerIds.length > 0) {
        const memberCount = guild.memberCount || "?";
        const embed = client.embedBuilder
          .base(client, t(lang, "events.guildDelete.title"))
          .addFields(
            {
              name: t(lang, "events.guildDelete.field_server"),
              value: `\`${guild.name || t(lang, "events.guildDelete.unknown_server")}\``,
              inline: true,
            },
            { name: "ID", value: `\`${guild.id}\``, inline: true },
            {
              name: t(lang, "events.guildDelete.field_members"),
              value: `\`${memberCount}\``,
              inline: true,
            },
          );

        for (const ownerId of ownerIds) {
          const ownerUser = await client.users
            .fetch(ownerId)
            .catch(() => null);
          if (!ownerUser) continue;

          // DM uniquement si le propriétaire est en ligne (presence visible)
          let isOnline = false;
          for (const [, g] of client.guilds.cache) {
            const m = g.members.cache.get(ownerId);
            if (m && m.presence && m.presence.status !== "offline") {
              isOnline = true;
              break;
            }
          }
          if (!isOnline) continue;

          await ownerUser
            .send({ embeds: [embed] })
            .catch((e) =>
              logger.warn(
                `[GUILD_DELETE] DM propriétaire ${ownerId} impossible : ${e.message}`,
              ),
            );
        }
      }
    } catch (err) {
      logger.error(`[GUILD_DELETE] Erreur notification : ${err.message}`, err);
    }
  },
};
