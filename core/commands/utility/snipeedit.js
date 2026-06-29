const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "snipeedit",
  description: "Affiche le dernier message édité",
  category: "utility",
  usage: "snipeedit",
  async execute(client, message, args) {
    const editSnipe = client.editSnipes?.get(message.channel.id);

    if (!editSnipe) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.snipeedit.no_message"),
            ),
          ],
        })
        .catch(() => {});
    }

    const ts = Math.floor(
      (editSnipe.timestamp instanceof Date
        ? editSnipe.timestamp.getTime()
        : editSnipe.timestamp) / 1000,
    );

    const embed = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setAuthor({ name: editSnipe.author, iconURL: editSnipe.avatar })
      .addFields(
        { name: message.t("commands.snipeedit.field_channel"), value: `<#${message.channel.id}>`, inline: true },
        { name: message.t("commands.snipeedit.field_edited"), value: `<t:${ts}:R>`, inline: true },
        {
          name: message.t("commands.snipeedit.field_before"),
          value: (editSnipe.oldContent || message.t("commands.snipeedit.empty")).slice(0, 1024),
          inline: false,
        },
        {
          name: message.t("commands.snipeedit.field_after"),
          value: (editSnipe.newContent || message.t("commands.snipeedit.empty")).slice(0, 1024),
          inline: false,
        },
      )
      .setTimestamp(editSnipe.timestamp);

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
