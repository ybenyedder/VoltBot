const { PermissionsBitField, ChannelType } = require("discord.js");
const permissions = require("../../utils/permissions");

const VARIABLES = "{user} {server} {membercount} {mention}";

module.exports = {
  name: "setwelcomemessage",
  aliases: ["setwelcometext", "welcometext"],
  description:
    "Configure un message texte de bienvenue (sans embed), envoyé en plus de l'embed si défini.",
  category: "config",
  usage: "+setwelcomemessage [#salon | off | message <texte>]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setwelcomemessage.perm_denied"),
            ),
          ],
        })
        .catch(() => {});

    const gs = client.db.getGuild(message.guild.id) || {};
    const noneLabel = message.t("commands.setwelcomemessage.none");
    const oldChannelId = gs.welcomeTextChannel || null;
    const oldChannelDisplay = oldChannelId ? `<#${oldChannelId}>` : noneLabel;
    const hasMsg = Boolean(gs.welcomeTextMessage);
    const oldMsg = gs.welcomeTextMessage || noneLabel;

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, null)
        .setAuthor({
          name: message.t("commands.setwelcomemessage.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setwelcomemessage.field_channel"), value: oldChannelDisplay, inline: true },
          {
            name: message.t("commands.setwelcomemessage.field_message"),
            value:
              !hasMsg ? noneLabel : `\`\`\`\n${oldMsg.slice(0, 1000)}\n\`\`\``,
            inline: false,
          },
          {
            name: message.t("commands.setwelcomemessage.field_usage"),
            value:
              "`+setwelcomemessage #salon`\n`+setwelcomemessage message <texte>`\n`+setwelcomemessage off`",
            inline: false,
          },
          { name: message.t("commands.setwelcomemessage.field_variables"), value: `\`${VARIABLES}\``, inline: false },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "off") {
      if (!oldChannelId && !gs.welcomeTextMessage) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setwelcomemessage.already_disabled"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, {
        welcomeTextChannel: null,
        welcomeTextMessage: null,
      });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcomemessage.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(
          "```diff\n- " +
            message.t("commands.setwelcomemessage.diff_channel") +
            " " +
            oldChannelDisplay +
            "\n- " +
            message.t("commands.setwelcomemessage.diff_message") +
            " " +
            (!hasMsg ? noneLabel : oldMsg.slice(0, 200)) +
            "\n+ " +
            message.t("commands.setwelcomemessage.diff_disabled") +
            "\n```",
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "message") {
      const text = args.slice(1).join(" ").trim();
      if (!text) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setwelcomemessage.message_missing"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (text.length > 1900) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setwelcomemessage.message_too_long"),
              ),
            ],
          })
          .catch(() => {});
      }
      if (text === oldMsg) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(client, message.t("commands.setwelcomemessage.same_value")),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { welcomeTextMessage: text });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcomemessage.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setwelcomemessage.field_before"), value: `\`\`\`\n${oldMsg.slice(0, 1000)}\n\`\`\`` },
          { name: message.t("commands.setwelcomemessage.field_after"), value: `\`\`\`\n${text.slice(0, 1000)}\n\`\`\`` },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const channel = message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setwelcomemessage.channel_invalid"),
            ),
          ],
        })
        .catch(() => {});
    }
    if (channel.id === oldChannelId) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.setwelcomemessage.same_value"))],
        })
        .catch(() => {});
    }
    client.db.updateGuild(message.guild.id, { welcomeTextChannel: channel.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setwelcomemessage.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(
        "```diff\n- " +
          oldChannelDisplay +
          "\n+ <#" +
          channel.id +
          ">\n```",
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
