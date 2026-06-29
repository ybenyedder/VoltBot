const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "snipe",
  description: "Affiche le dernier message supprimé dans ce salon.",
  category: "utility",
  usage: "+snipe",
  async execute(client, message, args) {
    if (!client.snipes) client.snipes = new Map();

    const snipe = client.snipes.get(message.channel.id);
    if (!snipe) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(client, message.t("commands.snipe.no_message")),
          ],
        })
        .catch(() => {});
    }

    const ts = Math.floor(
      (snipe.timestamp instanceof Date
        ? snipe.timestamp.getTime()
        : snipe.timestamp) / 1000,
    );
    const content = snipe.content || message.t("commands.snipe.empty");

    const embed = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setAuthor({ name: snipe.author, iconURL: snipe.avatar })
      .addFields(
        { name: message.t("commands.snipe.field_channel"), value: `<#${message.channel.id}>`, inline: true },
        { name: message.t("commands.snipe.field_deleted"), value: `<t:${ts}:R>`, inline: true },
        { name: message.t("commands.snipe.field_content"), value: content.slice(0, 1024), inline: false },
      )
      .setTimestamp(snipe.timestamp);

    if (snipe.image) embed.setImage(snipe.image);

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
