module.exports = {
  name: "get",
  description: "Récupère des informations sur un élément",
  category: "utility",
  usage: "get",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.get.type_required"),
            ),
          ],
        })
        .catch(() => {});
    }

    const type = args[0].toLowerCase();
    const target = args[1];

    switch (type) {
      case "user": {
        const user =
          message.mentions.users.first() ||
          client.users.cache.get(target) ||
          message.author;
        const member = message.guild.members.cache.get(user.id);

        const userEmbed = client.embedBuilder
          .premium(
            client,
            message.t("commands.get.user_title", { tag: user.tag }),
            `<@${user.id}>`,
            user.displayAvatarURL({ size: 256 }),
          )
          .addFields(
            { name: message.t("commands.get.field_id"), value: `\`${user.id}\``, inline: true },
            {
              name: message.t("commands.get.field_created"),
              value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`,
              inline: true,
            },
            {
              name: message.t("commands.get.field_joined"),
              value: member?.joinedAt
                ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`
                : message.t("commands.get.off_server"),
              inline: true,
            },
            {
              name: message.t("commands.get.field_roles"),
              value: member?.roles.cache.size
                ? `\`${member.roles.cache.size - 1}\``
                : "`0`",
              inline: true,
            },
          );

        return message.reply({ embeds: [userEmbed] }).catch(() => {});
      }

      case "role": {
        const role =
          message.mentions.roles.first() ||
          message.guild.roles.cache.get(target) ||
          message.guild.roles.cache.find(
            (r) => r.name.toLowerCase() === target?.toLowerCase(),
          );

        if (!role) {
          return message
            .reply({
              embeds: [
                client.embedBuilder.warning(client, message.t("commands.get.role_not_found")),
              ],
            })
            .catch(() => {});
        }

        const roleEmbed = client.embedBuilder
          .premium(client, message.t("commands.get.role_title", { name: role.name }), `<@&${role.id}>`)
          .setColor(role.color || client.embedBuilder.getTheme(client))
          .addFields(
            { name: message.t("commands.get.field_id"), value: `\`${role.id}\``, inline: true },
            {
              name: message.t("commands.get.field_members"),
              value: `\`${role.members.size}\``,
              inline: true,
            },
            {
              name: message.t("commands.get.field_position"),
              value: `\`${role.position}\``,
              inline: true,
            },
            {
              name: message.t("commands.get.field_color"),
              value: `\`${role.hexColor || "default"}\``,
              inline: true,
            },
            {
              name: message.t("commands.get.field_created"),
              value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`,
              inline: true,
            },
          );

        return message.reply({ embeds: [roleEmbed] }).catch(() => {});
      }

      case "channel": {
        const channel =
          message.mentions.channels.first() ||
          message.guild.channels.cache.get(target) ||
          message.guild.channels.cache.find(
            (c) => c.name.toLowerCase() === target?.toLowerCase(),
          );

        if (!channel) {
          return message
            .reply({
              embeds: [
                client.embedBuilder.warning(client, message.t("commands.get.channel_not_found")),
              ],
            })
            .catch(() => {});
        }

        const typeLabel =
          channel.type === 0
            ? message.t("commands.get.type_text")
            : channel.type === 2
              ? message.t("commands.get.type_voice")
              : channel.type === 4
                ? message.t("commands.get.type_category")
                : message.t("commands.get.type_other");

        const channelEmbed = client.embedBuilder.premium(
          client,
          message.t("commands.get.channel_title", { name: channel.name }),
          `<#${channel.id}>`,
        );
        const fields = [
          { name: message.t("commands.get.field_id"), value: `\`${channel.id}\``, inline: true },
          { name: message.t("commands.get.field_type"), value: `\`${typeLabel}\``, inline: true },
          {
            name: message.t("commands.get.field_created"),
            value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:D>`,
            inline: true,
          },
          {
            name: message.t("commands.get.field_position"),
            value: `\`${channel.position ?? "—"}\``,
            inline: true,
          },
        ];

        if (channel.type === 2) {
          fields.push(
            {
              name: message.t("commands.get.field_members"),
              value: `\`${channel.members.size}/${channel.userLimit || "∞"}\``,
              inline: true,
            },
            {
              name: message.t("commands.get.field_bitrate"),
              value: `\`${channel.bitrate / 1000} kbps\``,
              inline: true,
            },
          );
        }
        if (channel.topic) {
          fields.push({
            name: message.t("commands.get.field_description"),
            value: channel.topic.slice(0, 1024),
            inline: false,
          });
        }
        channelEmbed.addFields(fields);

        return message.reply({ embeds: [channelEmbed] }).catch(() => {});
      }

      case "server": {
        const owner = await message.guild.fetchOwner().catch(() => null);
        const fmt = new Intl.NumberFormat("fr-FR");
        const serverEmbed = client.embedBuilder
          .premium(
            client,
            message.t("commands.get.server_title", { name: message.guild.name }),
            owner ? `<@${owner.id}>` : message.t("commands.get.unknown_owner"),
            message.guild.iconURL({ size: 256 }) || undefined,
          )
          .addFields(
            { name: message.t("commands.get.field_id"), value: `\`${message.guild.id}\``, inline: true },
            {
              name: message.t("commands.get.field_created"),
              value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:D>`,
              inline: true,
            },
            {
              name: message.t("commands.get.field_members"),
              value: `\`${fmt.format(message.guild.memberCount)}\``,
              inline: true,
            },
            {
              name: message.t("commands.get.field_channels"),
              value: `\`${fmt.format(message.guild.channels.cache.size)}\``,
              inline: true,
            },
            {
              name: message.t("commands.get.field_roles"),
              value: `\`${fmt.format(message.guild.roles.cache.size)}\``,
              inline: true,
            },
          );

        return message.reply({ embeds: [serverEmbed] }).catch(() => {});
      }

      default:
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.get.type_invalid"),
              ),
            ],
          })
          .catch(() => {});
    }
  },
};
