const axios = require("axios");

module.exports = {
  name: "pat",
  description: "Tapote la tête de quelqu'un.",
  category: "social",
  usage: "+pat @user",
  async execute(client, message, args) {
    const target = message.mentions.users.first();
    if (!target) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.pat.target_not_found"))],
        })
        .catch(() => {});
    }

    if (target.id === message.author.id) {
      const selfEmbed = client.embedBuilder.premium(
        client,
        message.t("commands.pat.title"),
        message.t("commands.pat.self"),
      );
      return message.reply({ embeds: [selfEmbed] }).catch(() => {});
    }

    try {
      const res = await axios.get("https://some-random-api.com/animu/pat");

      const embed = client.embedBuilder
        .premium(client, message.t("commands.pat.title"), "")
        .setAuthor({
          name: message.t("commands.pat.author", { author: message.author.username, target: target.username }),
          iconURL: message.author.displayAvatarURL({ size: 256 }),
        })
        .setDescription(null)
        .setImage(res.data.link);

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.pat.gif_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
