const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setstarboard",
  description: "Configure le système de starboard.",
  category: "config",
  usage: "+setstarboard <#salon | off> [nombre_etoiles]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setstarboard.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldId = gs.starboardChannel || null;
    const oldChannelDisplay = oldId
      ? `<#${oldId}>`
      : message.t("commands.setstarboard.none");
    const oldCount = gs.starboardCount || 3;

    const channelInput = args[0];
    if (!channelInput) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setstarboard.no_argument"))
        .setAuthor({
          name: message.t("commands.setstarboard.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setstarboard.field_channel"),
            value: oldChannelDisplay,
            inline: true,
          },
          {
            name: message.t("commands.setstarboard.field_threshold"),
            value: `${oldCount}`,
            inline: true,
          },
          {
            name: message.t("commands.setstarboard.field_usage"),
            value: "`+setstarboard #salon [seuil]`\n`+setstarboard off`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (channelInput.toLowerCase() === "off") {
      if (!oldId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setstarboard.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { starboardChannel: null });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setstarboard.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- #" + oldId + "\n+ Aucun\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(channelInput);
    if (!channel)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setstarboard.invalid_channel"),
            ),
          ],
        })
        .catch(() => {});

    let count = parseInt(args[1]);
    if (!count || isNaN(count) || count < 1) count = 3;

    if (oldId === channel.id && oldCount === count) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setstarboard.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, {
      starboardChannel: channel.id,
      starboardCount: count,
    });

    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setstarboard.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.setstarboard.field_before"),
          value: message.t("commands.setstarboard.value_threshold", {
            channel: oldChannelDisplay,
            count: oldCount,
          }),
          inline: true,
        },
        {
          name: message.t("commands.setstarboard.field_after"),
          value: message.t("commands.setstarboard.value_threshold", {
            channel: `<#${channel.id}>`,
            count,
          }),
          inline: true,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
