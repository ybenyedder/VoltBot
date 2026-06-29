const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "setavis",
  description: "Définit le salon où les avis (+avis) seront envoyés.",
  category: "config",
  usage: "+setavis [#salon]",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const gs = client.db.getGuild(message.guild.id) || {};
    const oldId = gs.avisChannel || null;
    const oldDisplay = oldId ? `<#${oldId}>` : message.t("commands.setavis.none");

    if (!args[0]) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.setavis.no_arg"))
        .setAuthor({
          name: message.t("commands.setavis.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.setavis.current"), value: oldDisplay, inline: true },
          { name: message.t("commands.setavis.usage"), value: "`+setavis #salon`", inline: true },
        );
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
              message.t("commands.setavis.invalid_channel"),
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
              message.t("commands.setavis.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateGuild(message.guild.id, { avisChannel: channel.id });
    const embed = client.embedBuilder
      .success(client, null)
      .setAuthor({
        name: message.t("commands.setavis.title"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(null)
      .addFields(
        { name: message.t("commands.setavis.before"), value: oldDisplay, inline: true },
        { name: message.t("commands.setavis.after"), value: `<#${channel.id}>`, inline: true },
      );
    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
