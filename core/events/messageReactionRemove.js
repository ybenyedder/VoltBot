const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "messageReactionRemove",
  async execute(reaction, user, ...eventArgs) {
    const client = eventArgs[eventArgs.length - 1];
    if (!client?.db) {
      logger.error(
        "[REACTION_ROLE] Client DB indisponible sur messageReactionRemove",
      );
      return;
    }

    // Hydrate partials
    if (reaction.partial) {
      await reaction.fetch().catch(() => {});
    }
    if (reaction.message && reaction.message.partial) {
      await reaction.message.fetch().catch(() => {});
    }
    if (!reaction.message || !reaction.message.guild) return;
    if (user.bot) return;

    const guild = reaction.message.guild;
    const lang = client.db.getGuild(guild.id)?.language || "fr";

    // --- REACTION ROLES (unassign) ---
    // Lookup direct sur la table reaction_roles (messageId + emoji).
    try {
      const emojiKey = reaction.emoji.id || reaction.emoji.name;
      if (emojiKey) {
        const row = client.db.getReactionRole(reaction.message.id, emojiKey);
        // Symmetric guard with messageReactionAdd: never act on a row whose
        // guildId does not match the current guild (defense-in-depth).
        if (row && row.guildId && row.guildId !== guild.id) {
          return;
        }
        if (row) {
          const member = await guild.members.fetch(user.id).catch(() => null);
          const role = guild.roles.cache.get(row.roleId);
          const me = guild.members.me;
          if (member && role && me) {
            if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
              logger.warn(
                `[REACTION_ROLE] ManageRoles manquant sur ${guild.id}`,
              );
            } else if (me.roles.highest.position <= role.position) {
              logger.warn(
                `[REACTION_ROLE] Rôle ${role.id} au-dessus du bot, ignoré`,
              );
            } else if (member.roles.cache.has(role.id)) {
              await member.roles
                .remove(
                  role,
                  t(lang, "events.messageReactionRemove.reason_reaction_role_removed"),
                )
                .catch((e) =>
                  logger.warn(
                    `[REACTION_ROLE] Retrait impossible pour ${user.tag}: ${e.message}`,
                  ),
                );
            }
          }
          return; // panneau reaction-role : on n'évalue pas le starboard
        }
      }
    } catch (err) {
      logger.error(`[REACTION_ROLE] Erreur retrait: ${err.message}`, err);
    }

    // --- STARBOARD (score-down) ---
    try {
      const guildSettings = client.db.getGuild(guild.id);
      if (!guildSettings || !guildSettings.starboardChannel) return;
      if (reaction.emoji.name !== "" && reaction.emoji.name !== "star")
        return;

      const requiredStars = guildSettings.starboardCount || 3;
      const starboardChannel = guild.channels.cache.get(
        guildSettings.starboardChannel,
      );
      if (!starboardChannel) return;

      const pastMessages = await starboardChannel.messages
        .fetch({ limit: 50 })
        .catch(() => null);
      if (!pastMessages) return;

      const existing = pastMessages.find(
        (m) =>
          m.embeds[0] &&
          m.embeds[0].footer &&
          m.embeds[0].footer.text.includes(reaction.message.id),
      );
      if (!existing) return;

      if (reaction.count < requiredStars) {
        // Sous le seuil : supprimer l'entrée du starboard
        await existing
          .delete()
          .catch((e) =>
            logger.warn(`[STARBOARD] Suppression impossible: ${e.message}`),
          );
      } else {
        // Toujours au-dessus du seuil : mettre à jour le compteur
        const oldEmbed = existing.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed).setTitle(
          ` ${reaction.count}`,
        );
        await existing
          .edit({ embeds: [newEmbed] })
          .catch((e) =>
            logger.warn(`[STARBOARD] Mise à jour impossible: ${e.message}`),
          );
      }
    } catch (err) {
      logger.error(`[STARBOARD] Erreur retrait réaction: ${err.message}`, err);
    }
  },
};
