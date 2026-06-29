const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "editsnipe",
  aliases: ["esnipe"],
  description: "Affiche le dernier message édité dans ce salon.",
  category: "utility",
  usage: "+editsnipe",
  async execute(client, message, args) {
    if (!client.editSnipes) client.editSnipes = new Map();

    const snipe = client.editSnipes.get(message.channel.id);
    if (!snipe) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.editsnipe.no_edited_message"))],
        })
        .catch(() => {});
    }

    const ts = Math.floor(
      (snipe.timestamp instanceof Date
        ? snipe.timestamp.getTime()
        : snipe.timestamp) / 1000,
    );

    const embed = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setAuthor({ name: snipe.author, iconURL: snipe.avatar })
      .addFields(
        { name: message.t("commands.editsnipe.field_channel"), value: `<#${message.channel.id}>`, inline: true },
        { name: message.t("commands.editsnipe.field_edited"), value: `<t:${ts}:R>`, inline: true },
        {
          name: message.t("commands.editsnipe.field_before"),
          value: (snipe.oldContent || message.t("commands.editsnipe.empty")).slice(0, 1024),
          inline: false,
        },
        {
          name: message.t("commands.editsnipe.field_after"),
          value: (snipe.newContent || message.t("commands.editsnipe.empty")).slice(0, 1024),
          inline: false,
        },
      )
      .setTimestamp(snipe.timestamp);

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
