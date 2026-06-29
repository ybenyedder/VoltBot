const { PermissionsBitField } = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "setbirthdaychannel",
  aliases: ["setbday", "birthdaychan"],
  description: "Définit le salon dédié aux annonces d'anniversaires.",
  category: "config",
  usage: "+setbirthdaychannel [#salon | off]",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    if (!permissions.isAdmin(message))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbirthdaychannel.perm_denied"),
            ),
          ],
        })
        .catch(() => {});

    const gs = client.db.getGuild(message.guild.id) || {};
    const oldId = gs.birthdayChannel || null;
    const oldDisplay = oldId ? `<#${oldId}>` : message.t("commands.setbirthdaychannel.none");

    if (!args[0]) {
      const fallback = gs.welcomeChannel
        ? message.t("commands.setbirthdaychannel.fallback_welcome", { channel: `<#${gs.welcomeChannel}>` })
        : message.t("commands.setbirthdaychannel.none");
      const embed = client.embedBuilder
        .info(client, message.t("commands.setbirthdaychannel.no_arg"))
        .setAuthor({
          name: message.t("commands.setbirthdaychannel.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setbirthdaychannel.channel"), value: oldDisplay, inline: true },
          { name: message.t("commands.setbirthdaychannel.fallback"), value: fallback, inline: true },
          {
            name: message.t("commands.setbirthdaychannel.usage"),
            value: "`+setbirthdaychannel #salon`\n`+setbirthdaychannel off`",
            inline: false,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (args[0].toLowerCase() === "off") {
      if (!oldId) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.setbirthdaychannel.same_value"),
              ),
            ],
          })
          .catch(() => {});
      }
      client.db.updateGuild(message.guild.id, { birthdayChannel: null });
      const embed = client.embedBuilder
        .success(client, null)
        .setAuthor({
          name: message.t("commands.setbirthdaychannel.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription("```diff\n- #" + oldId + "\n+ " + message.t("commands.setbirthdaychannel.none") + "\n```");
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const channel =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]);
    if (!channel) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.setbirthdaychannel.invalid_channel"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (oldId === channel.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.setbirthdaychannel.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { birthdayChannel: channel.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setbirthdaychannel.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setbirthdaychannel.before"), value: oldDisplay, inline: true },
        { name: message.t("commands.setbirthdaychannel.after"), value: `<#${channel.id}>`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
