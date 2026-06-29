const axios = require("axios");

module.exports = {
  name: "meme",
  description: "Affiche un mème aléatoire depuis Reddit.",
  category: "fun",
  usage: "meme",
  async execute(client, message, args) {
    try {
      const response = await axios.get("https://meme-api.com/gimme/memes", {
        timeout: 8000,
      });
      const meme = response.data;

      if (!meme || !meme.url) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.meme.none_available"),
              ),
            ],
          })
          .catch(() => {});
      }

      const sub = meme.subreddit || "memes";
      const ups = new Intl.NumberFormat("fr-FR").format(meme.ups || 0);
      const embed = client.embedBuilder
        .premium(client, "Meme", "​")
        .setDescription(null)
        .setThumbnail(null)
        .setImage(meme.url)
        .setFooter({
          text: `r/${sub} • ${ups} ups`,
          iconURL: client?.user?.displayAvatarURL?.(),
        });

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.meme.fetch_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
