const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

const DEFAULT_MSG = "{user} a quitté le serveur.";

module.exports = {
  name: "setgoodbye",
  aliases: ["setleave", "setbye"],
  description: "Configure le message / salon d'au revoir.",
  category: "config",
  usage: "+setgoodbye [#salon | off | message <texte>]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setgoodbye.perm_denied"),
            ),
          ],
        })
        .catch(() => {});

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldChannelId = gs.goodbyeChannel || null;
    const oldChannelDisplay = oldChannelId ? `<#${oldChannelId}>` : message.t("commands.setgoodbye.none");
    const oldMsg = gs.goodbyeMessage || message.t("commands.setgoodbye.default_msg");

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setgoodbye.no_arg"))
        .setAuthor({
          name: message.t("commands.setgoodbye.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setgoodbye.channel"), value: oldChannelDisplay, inline: true },
          { name: message.t("commands.setgoodbye.message"), value: `\`${oldMsg}\``, inline: true },
          {
            name: message.t("commands.setgoodbye.variables"),
            value: "`{user}` `{server}` `{membercount}` `{mention}`",
            inline: false,
          },
          {
            name: message.t("commands.setgoodbye.usage"),
            value:
              "`+setgoodbye #salon`\n`+setgoodbye message <texte>`\n`+setgoodbye off`",
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
                message.t("commands.setgoodbye.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { goodbyeChannel: null });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setgoodbye.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- #" + oldChannelId + "\n+ " + message.t("commands.setgoodbye.none") + "\n```");
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
                message.t("commands.setgoodbye.message_missing"),
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
                message.t("commands.setgoodbye.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }

      client.db.updateGuild(message.guild.id, { goodbyeMessage: newMsg });
      const preview = newMsg
        .replace(/{user}/g, `**${message.author.username}**`)
        .replace(/{server}/g, message.guild.name)
        .replace(/{membercount}/g, message.guild.memberCount)
        .replace(/{mention}/g, `<@${message.author.id}>`);
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setgoodbye.title_message"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setgoodbye.before"), value: `\`${oldMsg}\``, inline: false },
          { name: message.t("commands.setgoodbye.after"), value: `\`${newMsg}\``, inline: false },
          { name: message.t("commands.setgoodbye.preview"), value: preview, inline: false },
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
              message.t("commands.setgoodbye.invalid_channel"),
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
              message.t("commands.setgoodbye.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { goodbyeChannel: channel.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setgoodbye.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setgoodbye.before"), value: oldChannelDisplay, inline: true },
        { name: message.t("commands.setgoodbye.after"), value: `<#${channel.id}>`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
