const { getAnimeGif } = require("../../utils/animeGif");
const Logger = require("../../utils/logger");

module.exports = {
  name: "slap",
  description: "Donne une gifle à quelqu'un.",
  category: "social",
  usage: "+slap @user",
  async execute(client, message, args) {
    const target = message.mentions.users.first();
    if (!target) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.slap.target_not_found"))],
        })
        .catch(() => {});
    }

    if (target.id === message.author.id) {
      const selfEmbed = client.embedBuilder.premium(
        client,
        message.t("commands.slap.title"),
        message.t("commands.slap.self"),
      );
      return message.reply({ embeds: [selfEmbed] }).catch(() => {});
    }

    try {
      const gifUrl = await getAnimeGif("slap");

      const embed = client.embedBuilder
        .premium(client, message.t("commands.slap.title"), null)
        .setAuthor({
          name: message.t("commands.slap.author", { author: message.author.username, target: target.username }),
          iconURL: message.author.displayAvatarURL({ size: 256 }),
        })
        .setDescription(null)
        .setImage(gifUrl);

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      Logger.error("[SLAP] Failed to execute slap command:", e);
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.slap.gif_error"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
