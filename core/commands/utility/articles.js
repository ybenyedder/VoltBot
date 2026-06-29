const axios = require("axios");

module.exports = {
  name: "articles",
  description: "Recherche des articles sur un sujet",
  category: "utility",
  usage: "articles",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.articles.topic_required"),
            ),
          ],
        })
        .catch(() => {});
    }

    const query = args.join(" ");

    try {
      const response = await axios.get(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=YOUR_API_KEY&language=fr&pageSize=5`,
      );

      if (response.data.articles.length === 0) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.warning(
                client,
                message.t("commands.articles.no_article"),
              ),
            ],
          })
          .catch(() => {});
      }

      const embed = client.embedBuilder
        .base(client, message.t("commands.articles.title", { query }))
        .setFooter({ text: "NewsAPI" });

      response.data.articles.forEach((article, index) => {
        const title =
          article.title.length > 80
            ? article.title.slice(0, 77) + "..."
            : article.title;
        embed.addFields({
          name: `${index + 1}. ${title}`,
          value: `\`${article.source.name}\` — [${message.t("commands.articles.read")}](${article.url})`,
        });
      });

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (error) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.articles.search_failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
