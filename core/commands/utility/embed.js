const {
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "embed",
  description:
    "Créez un embed personnalisé de manière interactive via Interface Graphique.",
  category: "utility",
  usage: "+embed",
  userPerms: [PermissionsBitField.Flags.ManageMessages],
  async execute(client, message, args) {
    if (!permissions.isModerator(message, client))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.embed.insufficient_permission")),
          ],
        })
        .catch(() => {});

    const preview = new EmbedBuilder()
      .setColor(client.embedBuilder.getTheme(client))
      .setAuthor({
        name: message.t("commands.embed.preview"),
        iconURL: client.user.displayAvatarURL({ size: 256 }),
      })
      .setTitle(message.t("commands.embed.title"))
      .setDescription(message.t("commands.embed.description_placeholder"))
      .addFields(
        { name: message.t("commands.embed.field1_name"), value: message.t("commands.embed.field_value"), inline: true },
        { name: message.t("commands.embed.field2_name"), value: message.t("commands.embed.field_value"), inline: true },
      );

    const openBtn = new ButtonBuilder()
      .setCustomId("open_embed_modal")
      .setLabel(message.t("commands.embed.edit_button"))
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(openBtn);

    await message.delete().catch(() => {});
    await message.channel
      .send({ embeds: [preview], components: [row] })
      .catch(() => {});
  },
};
