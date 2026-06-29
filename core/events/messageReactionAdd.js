const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const logger = require("../utils/logger");
const { t } = require("../utils/i18n");

module.exports = {
  name: "messageReactionAdd",
  async execute(reaction, user, ...eventArgs) {
    const client = eventArgs[eventArgs.length - 1];
    if (!client?.db) {
      logger.error(
        "[REACTION_ROLE] Client DB indisponible sur messageReactionAdd",
      );
      return;
    }

    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (!reaction.message) return;
    if (reaction.message.partial)
      await reaction.message.fetch().catch(() => {});
    if (user.bot || !reaction.message.guild) return;

    const guild = reaction.message.guild;

    // --- REACTION ROLES (assign) ---
    try {
      const emojiKey = reaction.emoji.id || reaction.emoji.name;
      if (emojiKey) {
        const row = client.db.getReactionRole(reaction.message.id, emojiKey);
        // messageIds are globally unique on Discord so cross-guild collisions
        // are not possible in practice, but reject any row whose guildId
        // doesn't match the current guild as a belt-and-braces guard.
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
            } else if (!member.roles.cache.has(role.id)) {
              const rrLang =
                client.db.getGuild(guild.id)?.language || "fr";
              await member.roles
                .add(
                  role,
                  t(rrLang, "events.messageReactionAdd.reaction_role_reason"),
                )
                .catch((e) =>
                  logger.warn(
                    `[REACTION_ROLE] Ajout impossible pour ${user.tag}: ${e.message}`,
                  ),
                );
            }
          }
          return; // panneau reaction-role : on ne tombe pas dans le starboard
        }
      }
    } catch (err) {
      logger.error(`[REACTION_ROLE] Erreur ajout: ${err.message}`, err);
    }

    if (reaction.emoji.name !== "") return;

    const guildSettings = client.db.getGuild(reaction.message.guild.id);
    if (!guildSettings || !guildSettings.starboardChannel) return;

    const lang = guildSettings.language || "fr";

    const requiredStars = guildSettings.starboardCount || 3;
    if (reaction.count < requiredStars) return;

    const starboardChannel = reaction.message.guild.channels.cache.get(
      guildSettings.starboardChannel,
    );
    if (!starboardChannel) return;

    // Check if message is already in starboard to avoid duplicates
    // We could store it in a standard table, but fetching the channel history is an easy fallback
    const pastMessages = await starboardChannel.messages
      .fetch({ limit: 50 })
      .catch(() => null);
    if (pastMessages) {
      const alreadyPosted = pastMessages.find(
        (m) =>
          m.embeds[0] &&
          m.embeds[0].footer &&
          m.embeds[0].footer.text.includes(reaction.message.id),
      );
      if (alreadyPosted) {
        // Just update star count
        const oldEmbed = alreadyPosted.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed).setTitle(
          ` ${reaction.count}`,
        );
        await alreadyPosted.edit({ embeds: [newEmbed] }).catch(() => {});
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(client.config.colors.warning)
      .setAuthor({
        name: reaction.message.author.tag,
        iconURL: reaction.message.author.displayAvatarURL(),
      })
      .setTitle(` ${reaction.count}`)
      .setDescription(
        reaction.message.content || t(lang, "events.messageReactionAdd.no_text"),
      )
      .addFields({
        name: t(lang, "events.messageReactionAdd.source"),
        value: t(lang, "events.messageReactionAdd.go_to_message", {
          url: reaction.message.url,
        }),
      })
      .setFooter({ text: `Message ID: ${reaction.message.id}` })
      .setTimestamp(reaction.message.createdAt);

    if (reaction.message.attachments.size > 0) {
      embed.setImage(reaction.message.attachments.first().url);
    }

    starboardChannel
      .send({
        content: t(lang, "events.messageReactionAdd.in_channel", {
          channel: `<#${reaction.message.channel.id}>`,
        }),
        embeds: [embed],
      })
      .catch(() => {});
  },
};
