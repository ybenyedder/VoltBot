const axios = require("axios");

module.exports = {
  name: "kiss",
  description: "Donne un bisou à quelqu'un.",
  category: "social",
  usage: "+kiss @user",
  async execute(client, message, args) {
    const target = message.mentions.users.first();
    if (!target) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.kiss.target_not_found"))],
        })
        .catch(() => {});
    }

    if (target.id === message.author.id) {
      const selfEmbed = client.embedBuilder.premium(
        client,
        message.t("commands.kiss.title"),
        message.t("commands.kiss.self"),
      );
      return message.reply({ embeds: [selfEmbed] }).catch(() => {});
    }

    try {
      const res = await axios.get("https://nekos.life/api/v2/img/kiss");

      const embed = client.embedBuilder
        .premium(client, message.t("commands.kiss.title"), "")
        .setAuthor({
          name: message.t("commands.kiss.author", { author: message.author.username, target: target.username }),
          iconURL: message.author.displayAvatarURL({ size: 256 }),
        })
        .setDescription(null)
        .setImage(res.data.url);

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.kiss.gif_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
