const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

const DEFAULT_MSG =
  "Bienvenue {user} sur **{server}**. Nous sommes {membercount} membres.";
const DEFAULT_TITLE = "Bienvenue.";

module.exports = {
  name: "setwelcome",
  aliases: ["welcomechannel"],
  description: "Configure le salon et le message de bienvenue.",
  category: "config",
  usage: "+setwelcome [#salon | off | message <texte>]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setwelcome.perm_denied"),
            ),
          ],
        })
        .catch(() => {});

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldChannelId = gs.welcomeChannel || null;
    const oldChannelDisplay = oldChannelId
      ? `<#${oldChannelId}>`
      : message.t("commands.setwelcome.none");
    const oldTitle = gs.welcomeTitle || DEFAULT_TITLE;
    const oldMsg = gs.welcomeMessage || DEFAULT_MSG;
    const oldGifDisplay = gs.welcomeGif
      ? message.t("commands.setwelcome.configured")
      : message.t("commands.setwelcome.none");

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setwelcome.no_argument"))
        .setAuthor({
          name: message.t("commands.setwelcome.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setwelcome.field_channel"), value: oldChannelDisplay, inline: true },
          { name: message.t("commands.setwelcome.field_title"), value: `\`${oldTitle}\``, inline: true },
          { name: message.t("commands.setwelcome.field_gif"), value: oldGifDisplay, inline: true },
          { name: message.t("commands.setwelcome.field_message"), value: `\`${oldMsg}\``, inline: false },
          {
            name: message.t("commands.setwelcome.field_variables"),
            value: "`{user}` `{server}` `{membercount}` `{mention}`",
            inline: false,
          },
          {
            name: message.t("commands.setwelcome.field_usage"),
            value:
              "`+setwelcome #salon`\n`+setwelcome message <texte>`\n`+setwelcome title <texte>`\n`+setwelcome gif <url|off>`\n`+setwelcome off`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const opt = args[0].toLowerCase();

    if (opt === "off") {
      if (!oldChannelId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setwelcome.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { welcomeChannel: null });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcome.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(
          "```diff\n- #" +
            oldChannelId +
            "\n+ " +
            message.t("commands.setwelcome.none") +
            "\n```",
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (opt === "title") {
      const newTitle = args.slice(1).join(" ");
      if (!newTitle)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setwelcome.title_missing"),
              ),
            ],
          })
          .catch(() => {});
      if (newTitle === oldTitle)
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setwelcome.same_value"),
              ),
            ],
          })
          .catch(() => {});
      client.db.updateGuild(message.guild.id, { welcomeTitle: newTitle });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcome.author_title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setwelcome.field_before"), value: `\`${oldTitle}\``, inline: true },
          { name: message.t("commands.setwelcome.field_after"), value: `\`${newTitle}\``, inline: true },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (opt === "gif") {
      const newGif = args[1];
      if (!newGif)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setwelcome.gif_url_missing"),
              ),
            ],
          })
          .catch(() => {});
      if (newGif.toLowerCase() === "off") {
        if (!gs.welcomeGif)
          return message
            .reply({
              embeds: [
                client.embedBuilder.warning(
                  client,
                  message.t("commands.setwelcome.same_value"),
                ),
              ],
            })
            .catch(() => {});
        client.db.updateGuild(message.guild.id, { welcomeGif: null });
        const embed = client.embedBuilder
          .success(client, null)
          .setAuthor({
            name: message.t("commands.setwelcome.author_gif"),
            iconURL: client.user.displayAvatarURL(),
          })
          .setDescription(
            "```diff\n- " +
              message.t("commands.setwelcome.configured") +
              "\n+ " +
              message.t("commands.setwelcome.none") +
              "\n```",
          );
        return message.reply({ embeds: [embed] }).catch(() => {});
      }
      if (!newGif.startsWith("http"))
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setwelcome.gif_url_invalid"),
              ),
            ],
          })
          .catch(() => {});

      client.db.updateGuild(message.guild.id, { welcomeGif: newGif });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcome.author_gif"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setwelcome.field_before"), value: oldGifDisplay, inline: true },
          { name: message.t("commands.setwelcome.field_after"), value: message.t("commands.setwelcome.configured"), inline: true },
        )
        .setImage(newGif);
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (opt === "message") {
      const newMsg = args.slice(1).join(" ");
      if (!newMsg)
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.setwelcome.message_missing"),
              ),
            ],
          })
          .catch(() => {});
      if (newMsg === oldMsg)
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setwelcome.same_value"),
              ),
            ],
          })
          .catch(() => {});
      client.db.updateGuild(message.guild.id, { welcomeMessage: newMsg });
      const preview = newMsg
        .replace(/{user}/g, `**${message.author.username}**`)
        .replace(/{server}/g, message.guild.name)
        .replace(/{membercount}/g, message.guild.memberCount)
        .replace(/{mention}/g, `<@${message.author.id}>`);
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setwelcome.author_message"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setwelcome.field_before"), value: `\`${oldMsg}\``, inline: false },
          { name: message.t("commands.setwelcome.field_after"), value: `\`${newMsg}\``, inline: false },
          { name: message.t("commands.setwelcome.field_preview"), value: preview, inline: false },
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
              message.t("commands.setwelcome.channel_invalid"),
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
              message.t("commands.setwelcome.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { welcomeChannel: channel.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setwelcome.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setwelcome.field_before"), value: oldChannelDisplay, inline: true },
        { name: message.t("commands.setwelcome.field_after"), value: `<#${channel.id}>`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
