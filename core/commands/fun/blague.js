module.exports = {
  name: "blague",
  aliases: ["joke"],
  description: "Raconte une blague aléatoire (FR).",
  category: "fun",
  usage: "blague",
  async execute(client, message, args) {
    try {
      const jokes = [
        {
          q: message.t("commands.blague.joke1_q"),
          a: message.t("commands.blague.joke1_a"),
        },
        {
          q: message.t("commands.blague.joke2_q"),
          a: message.t("commands.blague.joke2_a"),
        },
        {
          q: message.t("commands.blague.joke3_q"),
          a: message.t("commands.blague.joke3_a"),
        },
        {
          q: message.t("commands.blague.joke4_q"),
          a: message.t("commands.blague.joke4_a"),
        },
        {
          q: message.t("commands.blague.joke5_q"),
          a: message.t("commands.blague.joke5_a"),
        },
      ];

      const pick = jokes[Math.floor(Math.random() * jokes.length)];

      const embed = client.embedBuilder
        .base(client, message.t("commands.blague.title"), null)
        .addFields(
          { name: message.t("commands.blague.question"), value: pick.q, inline: false },
          { name: message.t("commands.blague.answer"), value: pick.a, inline: false },
        );

      await message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.blague.none_available")),
          ],
        })
        .catch(() => {});
    }
  },
};
