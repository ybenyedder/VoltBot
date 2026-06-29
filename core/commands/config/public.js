const { PermissionFlagsBits } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "public",
  description: "Restreint les commandes publiques à certains salons.",
  category: "config",
  usage: "+public <allow/deny/list> [salon]",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.public.admin_only"),
            ),
          ],
        })
        .catch(() => {});
    }

    const guild = client.db.getGuild(message.guild.id) || {};
    let publicChannels = JSON.parse(guild.publicChannels || "[]");

    const action = args[0];
    if (action === "list") {
      if (publicChannels.length === 0) {
        const embed = client.embedBuilder
          .base(client, message.t("commands.public.list_title"), null)
          .addFields(
            { name: message.t("commands.public.field_status"), value: message.t("commands.public.status_all"), inline: true },
            { name: message.t("commands.public.field_channel"), value: "—", inline: true },
          );
        return message.reply({ embeds: [embed] }).catch(() => {});
      }
      const list = publicChannels.map((id) => `<#${id}>`).join("\n");
      const embed = client.embedBuilder
        .base(client, message.t("commands.public.list_title"), null)
        .addFields(
          {
            name: message.t("commands.public.field_status"),
            value: message.t("commands.public.status_restricted_count", { n: publicChannels.length }),
            inline: true,
          },
          {
            name: message.t("commands.public.field_channel"),
            value: list.length > 1024 ? list.slice(0, 1020) + "…" : list,
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[1]) ||
      message.channel;
    if (!channel || ![0, 4, 5].includes(channel.type)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.public.invalid_text_channel")),
          ],
        })
        .catch(() => {});
    }

    if (action === "allow") {
      if (publicChannels.includes(channel.id)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .warning(client, message.t("commands.public.already_allowed"))
                .addFields({
                  name: message.t("commands.public.field_channel"),
                  value: `<#${channel.id}>`,
                  inline: true,
                }),
            ],
          })
          .catch(() => {});
      }
      publicChannels.push(channel.id);
      client.db.updateGuild(message.guild.id, {
        publicChannels: JSON.stringify(publicChannels),
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(client, message.t("commands.public.channel_added")).addFields(
              { name: message.t("commands.public.field_status"), value: message.t("commands.public.status_allowed"), inline: true },
              {
                name: message.t("commands.public.field_channel"),
                value: `<#${channel.id}>`,
                inline: true,
              },
            ),
          ],
        })
        .catch(() => {});
    }

    if (action === "deny") {
      if (!publicChannels.includes(channel.id)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .warning(client, message.t("commands.public.not_in_list"))
                .addFields({
                  name: message.t("commands.public.field_channel"),
                  value: `<#${channel.id}>`,
                  inline: true,
                }),
            ],
          })
          .catch(() => {});
      }
      publicChannels = publicChannels.filter((id) => id !== channel.id);
      client.db.updateGuild(message.guild.id, {
        publicChannels: JSON.stringify(publicChannels),
      });
      return message
        .reply({
          embeds: [
            client.embedBuilder.success(client, message.t("commands.public.channel_removed")).addFields(
              { name: message.t("commands.public.field_status"), value: message.t("commands.public.status_denied"), inline: true },
              {
                name: message.t("commands.public.field_channel"),
                value: `<#${channel.id}>`,
                inline: true,
              },
            ),
          ],
        })
        .catch(() => {});
    }

    return message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.public.usage"),
          ),
        ],
      })
      .catch(() => {});
  },
};
