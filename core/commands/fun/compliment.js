module.exports = {
  name: "compliment",
  description: "Fais un compliment à quelqu'un.",
  category: "fun",
  usage: "+compliment [@user]",
  async execute(client, message, args) {
    const target = message.mentions.users.first() || message.author;

    const compliments = [
      message.t("commands.compliment.line_1"),
      message.t("commands.compliment.line_2"),
      message.t("commands.compliment.line_3"),
      message.t("commands.compliment.line_4"),
      message.t("commands.compliment.line_5"),
      message.t("commands.compliment.line_6"),
      message.t("commands.compliment.line_7"),
      message.t("commands.compliment.line_8"),
    ];

    const line = compliments[Math.floor(Math.random() * compliments.length)];

    await message
      .reply({
        content: `<@${target.id}>`,
        embeds: [
          client.embedBuilder
            .base(
              client,
              message.t("commands.compliment.title"),
              message.t("commands.compliment.body", { user: `<@${target.id}>`, line }),
            )
            .setThumbnail(target.displayAvatarURL({ size: 256 })),
        ],
        allowedMentions: { users: [target.id] },
      })
      .catch(() => {});
  },
};
