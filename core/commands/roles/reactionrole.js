const { PermissionsBitField, ChannelType } = require("discord.js");
const permissions = require("../../utils/permissions");

/**
 * Parse un emoji (unicode ou custom Discord) et retourne :
 *   - clé canonique (id pour custom, unicode pour standard) pour stockage DB / match runtime
 *   - forme affichable (mention complète <:n:id> pour custom, sinon unicode brut)
 *   - forme utilisable par .react() (id pour custom, unicode pour standard)
 */
const parseEmoji = (raw) => {
  if (!raw) return null;
  const customMatch = raw.match(/^<(a?):(\w+):(\d+)>$/);
  if (customMatch) {
    const animated = customMatch[1] === "a";
    const name = customMatch[2];
    const id = customMatch[3];
    return {
      key: id,
      display: `<${animated ? "a" : ""}:${name}:${id}>`,
      reactable: id,
    };
  }
  // Refuse texte type ":ticket:" — pas un vrai emoji
  if (/^[a-zA-Z0-9_:]+$/.test(raw)) return null;
  return { key: raw, display: raw, reactable: raw };
};

module.exports = {
  name: "reactionrole",
  aliases: ["rrole", "rr"],
  description:
    "Crée un panneau de rôle par réaction, liste ou supprime un panneau existant.",
  category: "roles",
  usage:
    "+reactionrole #salon @role :emoji: [description] | +reactionrole list | +reactionrole del <messageId> <emoji>",
  userPerms: [
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.ManageMessages,
  ],
  botPerms: [PermissionsBitField.Flags.ManageRoles],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.reactionrole.admin_only")),
          ],
        })
        .catch(() => {});
    }

    // Garde-fou : le bot a ManageRoles ?
    if (
      !message.guild.members.me.permissions.has(
        PermissionsBitField.Flags.ManageRoles,
      )
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.reactionrole.bot_missing_manage_roles"),
            ),
          ],
        })
        .catch(() => {});
    }

    const sub = (args[0] || "").toLowerCase();

    // --- Sous-commande LIST ---
    if (sub === "list") {
      const rows = client.db.listReactionRoles(message.guild.id);
      if (!rows.length) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.info(client, message.t("commands.reactionrole.no_panels")),
            ],
          })
          .catch(() => {});
      }
      const lines = rows
        .slice(0, 25)
        .map((r) => {
          const role = message.guild.roles.cache.get(r.roleId);
          const roleTxt = role ? role.name : message.t("commands.reactionrole.deleted_role", { id: r.roleId });
          return `\`${r.messageId}\` — ${r.emoji} — ${roleTxt} — <#${r.channelId}>`;
        })
        .join("\n");
      const embed = client.embedBuilder.premium(
        client,
        message.t("commands.reactionrole.list_title"),
        lines,
      );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    // --- Sous-commande DEL ---
    if (sub === "del" || sub === "delete" || sub === "remove") {
      const messageId = args[1];
      const rawEmoji = args[2];
      if (!messageId || !rawEmoji) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.reactionrole.del_usage"),
              ),
            ],
          })
          .catch(() => {});
      }
      const parsed = parseEmoji(rawEmoji);
      if (!parsed) {
        return message
          .reply({
            embeds: [client.embedBuilder.error(client, message.t("commands.reactionrole.invalid_emoji"))],
          })
          .catch(() => {});
      }
      const res = client.db.removeReactionRole(messageId, parsed.key);
      if (!res || !res.changes) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.reactionrole.no_matching_panel")),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [client.embedBuilder.success(client, message.t("commands.reactionrole.panel_deleted"))],
        })
        .catch(() => {});
    }

    // --- Création : +reactionrole #salon @role :emoji: [description] ---
    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]);
    if (
      !channel ||
      ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
        channel.type,
      )
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.reactionrole.text_channel_not_found"),
            ),
          ],
        })
        .catch(() => {});
    }

    const role =
      message.mentions.roles.first() ||
      message.guild.roles.cache.get(args[1]);
    if (!role) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.reactionrole.role_not_found"))],
        })
        .catch(() => {});
    }

    // Hiérarchie : le bot doit être au-dessus du rôle cible
    if (message.guild.members.me.roles.highest.position <= role.position) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.reactionrole.role_higher_than_bot"),
            ),
          ],
        })
        .catch(() => {});
    }

    // Et l'auteur ne doit pas attribuer un rôle plus haut que le sien
    if (
      message.member.roles.highest.position <= role.position &&
      message.guild.ownerId !== message.author.id
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.reactionrole.role_higher_than_you"),
            ),
          ],
        })
        .catch(() => {});
    }

    const parsed = parseEmoji(args[2]);
    if (!parsed) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.reactionrole.invalid_emoji_full"),
            ),
          ],
        })
        .catch(() => {});
    }

    // Pour un emoji custom, vérifier qu'il est accessible au bot
    if (/^\d+$/.test(parsed.key)) {
      const known = client.emojis.cache.get(parsed.key);
      if (!known) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.reactionrole.custom_emoji_inaccessible"),
              ),
            ],
          })
          .catch(() => {});
      }
    }

    const description =
      args.slice(3).join(" ") || message.t("commands.reactionrole.default_description");

    try {
      await message.delete().catch(() => {});

      const panel = client.embedBuilder
        .premium(client, message.t("commands.reactionrole.panel_title"), description)
        .addFields(
          { name: message.t("commands.reactionrole.field_role"), value: `${role}`, inline: true },
          { name: message.t("commands.reactionrole.field_reaction"), value: parsed.display, inline: true },
        );

      const msg = await channel.send({ embeds: [panel] }).catch(() => null);
      if (!msg) {
        return message.channel
          .send({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.reactionrole.send_panel_failed")),
            ],
          })
          .catch(() => {});
      }

      const reacted = await msg.react(parsed.reactable).catch(() => null);
      if (!reacted) {
        await msg.delete().catch(() => {});
        return message.channel
          .send({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.reactionrole.react_failed"),
              ),
            ],
          })
          .catch(() => {});
      }

      client.db.addReactionRole(
        message.guild.id,
        msg.id,
        channel.id,
        parsed.key,
        role.id,
        message.author.id,
      );

      const confirm = client.embedBuilder
        .success(client, message.t("commands.reactionrole.panel_created"))
        .addFields(
          { name: message.t("commands.reactionrole.field_role"), value: `${role}`, inline: true },
          { name: message.t("commands.reactionrole.field_reaction"), value: parsed.display, inline: true },
          { name: message.t("commands.reactionrole.field_channel"), value: `${channel}`, inline: true },
          { name: message.t("commands.reactionrole.field_message"), value: `\`${msg.id}\``, inline: true },
        );
      await message.channel
        .send({ embeds: [confirm] })
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 8000))
        .catch(() => {});
    } catch (err) {
      await message.channel
        .send({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.reactionrole.creation_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
