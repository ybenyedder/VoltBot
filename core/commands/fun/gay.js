module.exports = {
  name: "gay",
  aliases: ["howgay"],
  description: "Affiche le % de gay de quelqu'un.",
  category: "fun",
  usage: "+gay [@user]",
  async execute(client, message, args) {
    const target = message.mentions.users.first() || message.author;

    let percent = Math.floor(Math.random() * 101);
    if (target.id === client.user.id) percent = 0;

    const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
    const gauge = `[${"█".repeat(filled)}${"░".repeat(10 - filled)}] ${percent}%`;

    const embed = client.embedBuilder
      .base(
        client,
        message.t("commands.gay.title"),
        message.t("commands.gay.body", { user: `<@${target.id}>`, percent }),
      )
      .addFields({ name: message.t("commands.gay.gauge"), value: `\`${gauge}\``, inline: false })
      .setThumbnail(target.displayAvatarURL({ size: 256 }));

    await message
      .reply({
        embeds: [embed],
        allowedMentions: { users: [target.id] },
      })
      .catch(() => {});
  },
};
