module.exports = {
  name: "ship",
  aliases: ["love"],
  description: "Calcule la compatibilité entre deux personnes.",
  category: "fun",
  usage: "+ship @user1 [@user2]",
  async execute(client, message, args) {
    const user1 = message.mentions.users.first() || message.author;
    const user2 =
      message.mentions.users.size > 1
        ? Array.from(message.mentions.users.values())[1]
        : message.author;

    if (user1.id === user2.id && user1.id === message.author.id) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.ship.need_member"),
            ),
          ],
        })
        .catch(() => {});
    }

    const shipScore = Math.floor(Math.random() * 101);

    let status;
    if (shipScore < 20) status = message.t("commands.ship.verdict_flee");
    else if (shipScore < 50) status = message.t("commands.ship.verdict_meh");
    else if (shipScore < 80) status = message.t("commands.ship.verdict_ok");
    else status = message.t("commands.ship.verdict_crazy_love");

    const filled = Math.round(shipScore / 10);
    const bar =
      "[" + "█".repeat(filled) + "░".repeat(10 - filled) + `] ${shipScore}%`;

    const shipName =
      user1.username.slice(0, Math.ceil(user1.username.length / 2)) +
      user2.username.slice(Math.floor(user2.username.length / 2));

    const embed = client.embedBuilder
      .base(
        client,
        message.t("commands.ship.title"),
        `<@${user1.id}> + <@${user2.id}>`,
      )
      .addFields(
        { name: message.t("commands.ship.field_couple"), value: `\`${shipName}\``, inline: true },
        { name: message.t("commands.ship.field_verdict"), value: status, inline: true },
        {
          name: message.t("commands.ship.field_score"),
          value: `**${shipScore}%**\n\`${bar}\``,
          inline: false,
        },
      )
      .setThumbnail(user1.displayAvatarURL({ size: 256 }));

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
