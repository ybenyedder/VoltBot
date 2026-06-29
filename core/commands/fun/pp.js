module.exports = {
  name: "pp",
  aliases: ["penis", "taille"],
  description: "Affiche la taille de PP (aléatoire).",
  category: "fun",
  usage: "+pp [@user]",
  async execute(client, message, args) {
    const target = message.mentions.users.first() || message.author;
    const size = Math.floor(Math.random() * 30);
    const percent = Math.round((size / 29) * 100);
    const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
    const gauge = `[${"█".repeat(filled)}${"░".repeat(10 - filled)}] ${percent}%`;
    const ppDraw = "8" + "=".repeat(size) + "D";

    const embed = client.embedBuilder
      .base(
        client,
        message.t("commands.pp.title"),
        message.t("commands.pp.size", { user: `<@${target.id}>`, size }),
      )
      .addFields(
        { name: message.t("commands.pp.field_gauge"), value: `\`${gauge}\``, inline: false },
        { name: message.t("commands.pp.field_shape"), value: `\`${ppDraw}\``, inline: false },
      )
      .setThumbnail(target.displayAvatarURL({ size: 256 }));

    await message
      .reply({
        embeds: [embed],
        allowedMentions: { users: [target.id] },
      })
      .catch(() => {});
  },
};
