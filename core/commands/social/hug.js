const { getAnimeGif } = require("../../utils/animeGif");
const Logger = require("../../utils/logger");

module.exports = {
  name: "hug",
  description: "Fait un câlin à quelqu'un.",
  category: "social",
  usage: "+hug @user",
  async execute(client, message, args) {
    const target = message.mentions.users.first();
    if (!target) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.hug.target_not_found"))],
        })
        .catch(() => {});
    }

    if (target.id === message.author.id) {
      const selfEmbed = client.embedBuilder.premium(
        client,
        message.t("commands.hug.title"),
        message.t("commands.hug.self"),
      );
      return message.reply({ embeds: [selfEmbed] }).catch(() => {});
    }

    try {
      const gifUrl = await getAnimeGif("hug");

      const embed = client.embedBuilder
        .premium(client, message.t("commands.hug.title"), null)
        .setAuthor({
          name: message.t("commands.hug.author", { author: message.author.username, target: target.username }),
          iconURL: message.author.displayAvatarURL({ size: 256 }),
        })
        .setDescription(null)
        .setImage(gifUrl);

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      Logger.error("[HUG] Failed to execute hug command:", e);
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.hug.gif_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
