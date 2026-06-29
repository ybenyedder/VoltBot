const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "theme",
  description:
    "Définit la couleur principale (thème) du bot de manière globale.",
  category: "config",
  usage: "+theme [couleur hex]",
  ownerOnly: true,
  async execute(client, message, args) {
    if (!client.db.isBotOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.theme.perm_denied"),
            ),
          ],
        })
        .catch(() => {});
    }

    const colorMap = {
      white: "#FFFFFF",
      black: "#000000",
      red: "#FF0000",
      green: "#00FF00",
      blue: "#0000FF",
      yellow: "#FFFF00",
      orange: "#FFA500",
      purple: "#800080",
      pink: "#FFC0CB",
      grey: "#808080",
      gray: "#808080",
      invisible: "#2B2D31",
    };

    const oldColor = client.embedBuilder.getTheme(client) || message.t("commands.theme.value_default");
    let hexColor = args[0]?.toLowerCase();

    if (!hexColor) {
      const embed = client.embedBuilder
        .info(client, message.t("commands.theme.no_argument"))
        .setAuthor({
          name: message.t("commands.theme.author"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setDescription(null)
        .addFields(
          { name: message.t("commands.theme.field_current"), value: `\`${oldColor}\``, inline: true },
          {
            name: message.t("commands.theme.field_usage"),
            value: "`+theme <hex>`\n`+theme red`",
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (colorMap[hexColor]) {
      hexColor = colorMap[hexColor];
    }

    if (!/^#?[0-9A-Fa-f]{6}$/.test(hexColor)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.theme.color_invalid"),
            ),
          ],
        })
        .catch(() => {});
    }

    const color = hexColor.startsWith("#")
      ? hexColor.toUpperCase()
      : `#${hexColor.toUpperCase()}`;

    if (oldColor.toUpperCase() === color) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.theme.same_value"),
            ),
          ],
        })
        .catch(() => {});
    }

    client.db.updateBotSettings({ themeColor: color });

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: message.t("commands.theme.author"),
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription("```diff\n- " + oldColor + "\n+ " + color + "\n```")
      .setFooter({ text: "ZeroDay • Made by ZeroDay" })
      .setTimestamp();

    return message.reply({ embeds: [embed] }).catch(() => {});
  },
};
