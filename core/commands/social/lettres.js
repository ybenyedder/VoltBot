const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  name: "lettres",
  aliases: ["lettresanonymes", "anonletter"],
  description: "Configure le système de Lettres Anonymes dans un salon.",
  category: "social",
  usage: "+lettres",
  userPerms: [PermissionsBitField.Flags.Administrator],
  async execute(client, message, args) {
    const embed = client.embedBuilder
      .premium(client, message.t("commands.lettres.title"), "")
      .setAuthor({
        name: message.t("commands.lettres.title"),
        iconURL: client?.user?.displayAvatarURL?.({ size: 256 }),
      })
      .setDescription(
        [
          message.t("commands.lettres.desc_line1"),
          message.t("commands.lettres.desc_line2"),
          message.t("commands.lettres.desc_line3"),
          message.t("commands.lettres.desc_line4"),
        ].join("\n"),
      )
      .setImage("https://media.giphy.com/media/ya4eevXU490Iw/giphy.gif");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("lettres_start")
        .setLabel(message.t("commands.lettres.btn_send"))
        .setStyle(ButtonStyle.Primary),
    );

    await message.channel
      .send({ embeds: [embed], components: [row] })
      .catch(() => {});
    await message.delete().catch(() => {});
  },
};
