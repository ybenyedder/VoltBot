const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

const DEFAULT_MSG = "{user}, tu viens de passer niveau **{level}**.";

module.exports = {
  name: "setlevel",
  aliases: ["setlevelchannel"],
  description: "Configure le salon et le message d'annonce des niveaux.",
  category: "config",
  usage: "+setlevel [#salon | off | message <texte>]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setlevel.perm_denied"),
            ),
          ],
        })
        .catch(() => {});

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldChannelId = gs.levelChannel || null;
    const oldChannelDisplay = oldChannelId
      ? `<#${oldChannelId}>`
      : message.t("commands.setlevel.none");
    const oldMsg = gs.levelMessage || DEFAULT_MSG;

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setlevel.no_argument"))
        .setAuthor({
          name: message.t("commands.setlevel.author_levels"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setlevel.field_channel"),
            value: oldChannelDisplay,
            inline: true,
          },
          {
            name: message.t("commands.setlevel.field_message"),
            value: `\`${oldMsg}\``,
            inline: true,
          },
          {
            name: message.t("commands.setlevel.field_variables"),
            value: "`{user}` `{level}`",
            inline: false,
          },
          {
            name: message.t("commands.setlevel.field_usage"),
            value:
              "`+setlevel #salon`\n`+setlevel message <texte>`\n`+setlevel off`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "off") {
      if (!oldChannelId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setlevel.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { levelChannel: null });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setlevel.author_levels"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- #" + oldChannelId + "\n+ Aucun\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "message") {
      const newMsg = args.slice(1).join(" ");
      if (!newMsg)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setlevel.message_missing"),
              ),
            ],
          })
          .catch(() => {});

      if (newMsg === oldMsg) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setlevel.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }

      client.db.updateGuild(message.guild.id, { levelMessage: newMsg });
      const preview = newMsg
        .replace(/{user}/g, `<@${message.author.id}>`)
        .replace(/{level}/g, "10");
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setlevel.author_level_message"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.setlevel.field_before"),
            value: `\`${oldMsg}\``,
            inline: false,
          },
          {
            name: message.t("commands.setlevel.field_after"),
            value: `\`${newMsg}\``,
            inline: false,
          },
          {
            name: message.t("commands.setlevel.field_preview"),
            value: preview,
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]);
    if (!channel)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setlevel.invalid_channel"),
            ),
          ],
        })
        .catch(() => {});

    if (oldChannelId === channel.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setlevel.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { levelChannel: channel.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setlevel.author_levels"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.setlevel.field_before"),
          value: oldChannelDisplay,
          inline: true,
        },
        {
          name: message.t("commands.setlevel.field_after"),
          value: `<#${channel.id}>`,
          inline: true,
        },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
