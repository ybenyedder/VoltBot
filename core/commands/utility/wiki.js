const { EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
  name: "wiki",
  description: "Recherche sur Wikipédia",
  category: "utility",
  usage: "wiki",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.wiki.term_required"),
            ),
          ],
        })
        .catch(() => {});
    }

    const query = args.join(" ");

    try {
      const response = await axios.get(
        `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      );

      if (
        response.data.type === "https://mediawiki.org/api/rest_v1/page/redirect"
      ) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.wiki.redirect_detected"),
              ),
            ],
          })
          .catch(() => {});
      }

      const wikiIcon =
        "https://upload.wikimedia.org/wikipedia/commons/8/80/Wikipedia-logo-v2.svg";
      const url = response.data.content_urls.desktop.page;
      const raw = response.data.extract || message.t("commands.wiki.no_extract");
      const lines = raw
        .split(/(?<=\.)\s+/)
        .slice(0, 4)
        .join(" ");
      const description =
        lines.length > 600 ? lines.slice(0, 597) + "..." : lines;

      const embed = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({ name: response.data.title, iconURL: wikiIcon })
        .setURL(url)
        .setDescription(description)
        .setThumbnail(response.data.thumbnail?.source || null)
        .addFields({ name: message.t("commands.wiki.field_source"), value: `[Wikipédia](${url})` })
        .setTimestamp()
        .setFooter({ text: message.t("commands.wiki.footer_source"), iconURL: wikiIcon });

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (error) {
      message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.wiki.no_article"))],
        })
        .catch(() => {});
    }
  },
};
