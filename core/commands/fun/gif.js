const axios = require("axios");

module.exports = {
  name: "gif",
  description: "Cherche un GIF (via Tenor).",
  category: "fun",
  usage: "+gif [mot clé]",
  async execute(client, message, args) {
    if (!args[0])
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.gif.missing_keyword"),
            ),
          ],
        })
        .catch(() => {});

    try {
      const tenorApiKey = process.env.TENOR_API_KEY;
      if (!tenorApiKey) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.gif.no_api_key"),
              ),
            ],
          })
          .catch(() => {});
      }

      const query = args.join(" ");
      const response = await axios.get(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${tenorApiKey}&limit=10`,
        { timeout: 8000 },
      );

      if (response.data.results && response.data.results.length > 0) {
        const pick =
          response.data.results[
            Math.floor(Math.random() * response.data.results.length)
          ];
        const gifUrl =
          pick.media_formats?.gif?.url || pick.media_formats?.tinygif?.url;
        if (!gifUrl) {
          return message
            .reply({
              embeds: [
                client.embedBuilder.error(client, message.t("commands.gif.no_usable_gif")),
              ],
            })
            .catch(() => {});
        }
        const embed = client.embedBuilder
          .premium(client, "GIF", "​")
          .setDescription(null)
          .setThumbnail(null)
          .setImage(gifUrl)
          .setFooter({
            text: `Tenor • ${query}`,
            iconURL: client?.user?.displayAvatarURL?.(),
          });
        await message.reply({ embeds: [embed] }).catch(() => {});
      } else {
        await message
          .reply({
            embeds: [
              client.embedBuilder.error(client, message.t("commands.gif.no_result", { query })),
            ],
          })
          .catch(() => {});
      }
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.gif.unavailable"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
