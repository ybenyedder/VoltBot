const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

const DEFAULT_MSG = "Tu as quitté **{server}**.";

module.exports = {
  name: "setgoodbyedm",
  aliases: ["goodbyedm", "byedm", "setleavedm"],
  description:
    "Configure le message privé (MP) envoyé quand un membre quitte le serveur.",
  category: "config",
  usage: "+setgoodbyedm [on | off | <message>]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setgoodbyedm.perm_denied"),
            ),
          ],
        })
        .catch(() => {});

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldEnabled = gs.goodbyeDm === 1;
    const oldStatus = oldEnabled ? message.t("commands.setgoodbyedm.enabled") : message.t("commands.setgoodbyedm.disabled");
    const oldMsg = gs.goodbyeDmMessage || message.t("commands.setgoodbyedm.default_msg");

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setgoodbyedm.no_arg"))
        .setAuthor({
          name: message.t("commands.setgoodbyedm.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setgoodbyedm.status"), value: oldStatus, inline: true },
          { name: message.t("commands.setgoodbyedm.message"), value: `\`${oldMsg}\``, inline: true },
          {
            name: message.t("commands.setgoodbyedm.variables"),
            value: "`{user}` `{server}` `{membercount}`",
            inline: false,
          },
          {
            name: message.t("commands.setgoodbyedm.usage"),
            value:
              "`+setgoodbyedm on`\n`+setgoodbyedm off`\n`+setgoodbyedm <message>`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const option = args[0].toLowerCase();

    if (option === "off") {
      if (!oldEnabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setgoodbyedm.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { goodbyeDm: 0 });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setgoodbyedm.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- " + message.t("commands.setgoodbyedm.enabled") + "\n+ " + message.t("commands.setgoodbyedm.disabled") + "\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (option === "on") {
      if (oldEnabled) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setgoodbyedm.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { goodbyeDm: 1 });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setgoodbyedm.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- " + message.t("commands.setgoodbyedm.disabled") + "\n+ " + message.t("commands.setgoodbyedm.enabled") + "\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const newMsg = args.join(" ");
    if (newMsg === oldMsg && oldEnabled) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setgoodbyedm.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, {
      goodbyeDm: 1,
      goodbyeDmMessage: newMsg,
    });

    const preview = newMsg
      .replace(/{user}/g, `**${message.author.username}**`)
      .replace(/{server}/g, message.guild.name)
      .replace(/{membercount}/g, message.guild.memberCount);

    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setgoodbyedm.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setgoodbyedm.before"), value: `\`${oldMsg}\``, inline: false },
        { name: message.t("commands.setgoodbyedm.after"), value: `\`${newMsg}\``, inline: false },
        { name: message.t("commands.setgoodbyedm.preview"), value: preview, inline: false },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
