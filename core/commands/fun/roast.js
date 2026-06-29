module.exports = {
  name: "roast",
  aliases: ["insulte"],
  description: "Clash quelqu'un (pour rire).",
  category: "fun",
  usage: "+roast [@user]",
  async execute(client, message, args) {
    const target = message.mentions.users.first() || message.author;

    const roasts = [
      message.t("commands.roast.line_1"),
      message.t("commands.roast.line_2"),
      message.t("commands.roast.line_3"),
      message.t("commands.roast.line_4"),
      message.t("commands.roast.line_5"),
      message.t("commands.roast.line_6"),
      message.t("commands.roast.line_7"),
      message.t("commands.roast.line_8"),
    ];

    const line = roasts[Math.floor(Math.random() * roasts.length)];

    await message
      .reply({
        content: `<@${target.id}>`,
        embeds: [
          client.embedBuilder
            .base(client, message.t("commands.roast.title"), `<@${target.id}>, ${line}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 })),
        ],
        allowedMentions: { users: [target.id] },
      })
      .catch(() => {});
  },
};
