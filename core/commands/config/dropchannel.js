const { PermissionFlagsBits } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "dropchannel",
  aliases: ["setdrop", "dropchannels"],
  description:
    "Configure les salons où les coffres (drops) peuvent apparaître.",
  category: "config",
  usage: "+dropchannel <add/remove/list/all> [salon]",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message, client)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.dropchannel.admin_only"),
            ),
          ],
        })
        .catch(() => {});
    }

    const guildSettings = client.db.getGuild(message.guild.id);
    let dropChannels = JSON.parse(guildSettings.dropChannels || "[]");

    const action = args[0]?.toLowerCase();

    if (action === "add") {
      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[1]);
      if (!channel || channel.type !== 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.dropchannel.text_channel_not_found"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (dropChannels.includes(channel.id)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .warning(client, message.t("commands.dropchannel.already_in_list"))
                .addFields({
                  name: message.t("commands.dropchannel.field_channel"),
                  value: `<#${channel.id}>`,
                  inline: true,
                }),
            ],
          })
          .catch(() => {});
      }

      const before = dropChannels.length;
      dropChannels.push(channel.id);
      client.db.updateGuild(message.guild.id, {
        dropChannels: JSON.stringify(dropChannels),
      });

      return message
        .reply({
          embeds: [
            client.embedBuilder.success(client, message.t("commands.dropchannel.channel_added")).addFields(
              {
                name: message.t("commands.dropchannel.field_channel"),
                value: `<#${channel.id}>`,
                inline: true,
              },
              {
                name: message.t("commands.dropchannel.field_before"),
                value: `${before}`,
                inline: true,
              },
              {
                name: message.t("commands.dropchannel.field_after"),
                value: `**${dropChannels.length}**`,
                inline: true,
              },
            ),
          ],
        })
        .catch(() => {});
    }

    if (action === "remove") {
      const channel =
        message.mentions.channels.first() ||
        message.guild.channels.cache.get(args[1]);
      if (!channel) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.dropchannel.channel_not_found"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (!dropChannels.includes(channel.id)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder
                .warning(client, message.t("commands.dropchannel.not_in_list"))
                .addFields({
                  name: message.t("commands.dropchannel.field_channel"),
                  value: `<#${channel.id}>`,
                  inline: true,
                }),
            ],
          })
          .catch(() => {});
      }

      const before = dropChannels.length;
      dropChannels = dropChannels.filter((id) => id !== channel.id);
      client.db.updateGuild(message.guild.id, {
        dropChannels: JSON.stringify(dropChannels),
      });

      return message
        .reply({
          embeds: [
            client.embedBuilder.success(client, message.t("commands.dropchannel.channel_removed")).addFields(
              {
                name: message.t("commands.dropchannel.field_channel"),
                value: `<#${channel.id}>`,
                inline: true,
              },
              {
                name: message.t("commands.dropchannel.field_before"),
                value: `${before}`,
                inline: true,
              },
              {
                name: message.t("commands.dropchannel.field_after"),
                value: `**${dropChannels.length}**`,
                inline: true,
              },
            ),
          ],
        })
        .catch(() => {});
    }

    if (action === "list") {
      if (dropChannels.length === 0) {
        const embed = client.embedBuilder
          .base(client, message.t("commands.dropchannel.list_title"), null)
          .addFields(
            { name: message.t("commands.dropchannel.field_status"), value: message.t("commands.dropchannel.status_all"), inline: true },
            { name: message.t("commands.dropchannel.field_total"), value: "0", inline: true },
          );
        return message.reply({ embeds: [embed] }).catch(() => {});
      }

      const list = dropChannels.map((id) => `<#${id}>`).join("\n");
      const embed = client.embedBuilder
        .base(client, message.t("commands.dropchannel.list_title"), null)
        .addFields(
          {
            name: message.t("commands.dropchannel.field_status"),
            value: message.t("commands.dropchannel.status_restricted"),
            inline: true,
          },
          {
            name: message.t("commands.dropchannel.field_total"),
            value: `**${dropChannels.length}**`,
            inline: true,
          },
          {
            name: message.t("commands.dropchannel.field_channels"),
            value: list.length > 1024 ? list.slice(0, 1020) + "…" : list,
            inline: false,
          },
        );

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (action === "all") {
      const before = dropChannels.length;
      client.db.updateGuild(message.guild.id, { dropChannels: "[]" });
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .success(client, message.t("commands.dropchannel.restriction_lifted"))
              .addFields(
                { name: message.t("commands.dropchannel.field_status"), value: message.t("commands.dropchannel.status_all_bold"), inline: true },
                { name: message.t("commands.dropchannel.field_before"), value: `${before}`, inline: true },
                { name: message.t("commands.dropchannel.field_after"), value: "0", inline: true },
              ),
          ],
        })
        .catch(() => {});
    }

    const helpEmbed = client.embedBuilder
      .base(client, message.t("commands.dropchannel.help_title"), null)
      .addFields(
        {
          name: message.t("commands.dropchannel.field_status"),
          value:
            dropChannels.length > 0
              ? message.t("commands.dropchannel.status_restricted_count", { n: dropChannels.length })
              : message.t("commands.dropchannel.status_all"),
          inline: true,
        },
        {
          name: message.t("commands.dropchannel.field_subcommands"),
          value: message.t("commands.dropchannel.subcommands_value"),
          inline: false,
        },
      );
    return message.reply({ embeds: [helpEmbed] }).catch(() => {});
  },
};
