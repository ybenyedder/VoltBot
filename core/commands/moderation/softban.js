const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "softban",
  description:
    "Banni et débanni instantanément un utilisateur (supprime les messages)",
  category: "moderation",
  usage: "softban",
  userPerms: [PermissionFlagsBits.BanMembers],
  botPerms: [PermissionFlagsBits.BanMembers],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.softban.target_missing"),
            ),
          ],
        })
        .catch(() => {});
    }

    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!member)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.softban.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.softban.target_protected"),
            ),
          ],
        })
        .catch(() => {});
    }

    const reason = args.slice(1).join(" ") || message.t("commands.softban.no_reason");
    const ts = Math.floor(Date.now() / 1000);

    try {
      const savedRoles = member.roles.cache
        .filter((role) => role.id !== message.guild.id)
        .map((role) => role.id);
      client.db.updateUser(
        member.id,
        member.guild.id,
        "savedRoles",
        savedRoles,
      );

      await message.guild.members.ban(member, {
        reason: `[SOFTBAN] ${reason}`,
        deleteMessageSeconds: 7 * 24 * 3600,
      });

      await message.guild.members.unban(
        member.id,
        message.t("commands.softban.audit_reason_unban"),
      );

      const embed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({
          name: message.t("commands.softban.embed_author"),
          iconURL: member.user.displayAvatarURL({ size: 256 }),
        })
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: message.t("commands.softban.field_target"), value: `<@${member.id}>`, inline: true },
          {
            name: message.t("commands.softban.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
          { name: message.t("commands.softban.field_date"), value: `<t:${ts}:R>`, inline: true },
          { name: message.t("commands.softban.field_messages"), value: message.t("commands.softban.field_messages_value"), inline: true },
          { name: message.t("commands.softban.field_roles"), value: message.t("commands.softban.field_roles_value"), inline: true },
          { name: message.t("commands.softban.field_reason"), value: reason, inline: false },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});

      const guildSettings = client.db.getGuild(message.guild.id);
      if (guildSettings.modLogsChannel) {
        const logChannel = message.guild.channels.cache.get(
          guildSettings.modLogsChannel,
        );
        if (logChannel)
          logChannel
            .send({
              embeds: [
                client.embedBuilder.modLog(
                  client,
                  "Softban",
                  member.user,
                  message.author,
                  reason,
                  [],
                  message.lang,
                ),
              ],
            })
            .catch(() => {});
      }
    } catch (error) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.softban.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
