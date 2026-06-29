module.exports = {
  name: "idemoji",
  description: "Récupère l'ID d'un emoji",
  category: "utility",
  usage: "idemoji",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.idemoji.mention_emoji"))],
        })
        .catch(() => {});
    }

    const emojiMatch = args[0].match(/<a?:([^:]+):(\d+)>/);
    if (!emojiMatch) {
      return message
        .reply({
          embeds: [client.embedBuilder.warning(client, message.t("commands.idemoji.invalid_emoji"))],
        })
        .catch(() => {});
    }

    const emojiName = emojiMatch[1];
    const emojiId = emojiMatch[2];
    const ext = args[0].startsWith("<a:") ? "gif" : "png";
    const url = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;

    const embed = client.embedBuilder
      .base(client, emojiName)
      .setAuthor({ name: emojiName, iconURL: url })
      .setThumbnail(url)
      .addFields(
        { name: "ID", value: `\`${emojiId}\``, inline: true },
        { name: message.t("commands.idemoji.animated"), value: ext === "gif" ? message.t("commands.idemoji.yes") : message.t("commands.idemoji.no"), inline: true },
        { name: message.t("commands.idemoji.format"), value: `\`${ext}\``, inline: true },
        { name: "URL", value: `[${message.t("commands.idemoji.open")}](${url})`, inline: false },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
