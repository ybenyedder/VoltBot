const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "autodelete",
  description: "Configure la suppression automatique de messages",
  category: "moderation",
  usage: "autodelete",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!args[0]) {
      const autodelete =
        client.db.getGuild(message.guild.id, "autodelete") || {};
      const embed = client.embedBuilder
        .base(
          client,
          message.t("commands.autodelete.title"),
          message.t("commands.autodelete.current_config"),
        )
        .addFields(
          {
            name: message.t("commands.autodelete.field_status"),
            value: autodelete.enabled
              ? message.t("commands.autodelete.enabled")
              : message.t("commands.autodelete.disabled"),
            inline: true,
          },
          {
            name: message.t("commands.autodelete.field_channel"),
            value: autodelete.channel
              ? `<#${autodelete.channel}>`
              : message.t("commands.autodelete.not_configured"),
            inline: true,
          },
          {
            name: message.t("commands.autodelete.field_delay"),
            value: autodelete.time
              ? `${autodelete.time} s`
              : message.t("commands.autodelete.not_configured"),
            inline: true,
          },
          {
            name: message.t("commands.autodelete.field_usage"),
            value:
              "`+autodelete enable/disable`\n`+autodelete channel #salon`\n`+autodelete time <secondes>`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const action = args[0].toLowerCase();
    const autodelete = client.db.getGuild(message.guild.id, "autodelete") || {};

    switch (action) {
      case "enable":
        autodelete.enabled = true;
        client.db.updateGuild(message.guild.id, { autodelete });
        await message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.autodelete.enabled_msg"),
              ),
            ],
          })
          .catch(() => {});
        break;

      case "disable":
        autodelete.enabled = false;
        client.db.updateGuild(message.guild.id, { autodelete });
        await message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.autodelete.disabled_msg"),
              ),
            ],
          })
          .catch(() => {});
        break;

      case "channel": {
        const channel = message.mentions.channels.first();
        if (!channel)
          return message
            .reply({
              embeds: [
                client.embedBuilder.error(
                  client,
                  message.t("commands.autodelete.invalid_channel"),
                ),
              ],
            })
            .catch(() => {});
        autodelete.channel = channel.id;
        client.db.updateGuild(message.guild.id, { autodelete });
        await message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.autodelete.channel_set", {
                  channel: `<#${channel.id}>`,
                }),
              ),
            ],
          })
          .catch(() => {});
        break;
      }

      case "time": {
        const time = parseInt(args[1]);
        if (!time || time < 1)
          return message
            .reply({
              embeds: [
                client.embedBuilder.error(
                  client,
                  message.t("commands.autodelete.invalid_duration"),
                ),
              ],
            })
            .catch(() => {});
        autodelete.time = time;
        client.db.updateGuild(message.guild.id, { autodelete });
        await message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.autodelete.delay_set", { time }),
              ),
            ],
          })
          .catch(() => {});
        break;
      }

      default:
        await message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.autodelete.invalid_action"),
              ),
            ],
          })
          .catch(() => {});
    }
  },
};
