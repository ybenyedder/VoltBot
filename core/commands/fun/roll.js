module.exports = {
  name: "roll",
  description: "Lance un ou plusieurs dés (ex: +roll 2d6).",
  category: "fun",
  usage: "+roll [NdN]",
  async execute(client, message, args) {
    let diceCount = 1;
    let diceFaces = 6;

    if (args[0]) {
      const match = args[0].match(/^(\d+)d(\d+)$/i);
      if (match) {
        diceCount = parseInt(match[1]);
        diceFaces = parseInt(match[2]);
      } else if (!isNaN(parseInt(args[0]))) {
        diceFaces = parseInt(args[0]);
      }
    }

    if (diceCount > 20)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.roll.max_dice"))],
        })
        .catch(() => {});
    if (diceCount < 1)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.roll.min_dice"))],
        })
        .catch(() => {});
    if (diceFaces < 2 || diceFaces > 100)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.roll.faces_range"))],
        })
        .catch(() => {});

    const results = [];
    let total = 0;
    for (let i = 0; i < diceCount; i++) {
      const roll = Math.floor(Math.random() * diceFaces) + 1;
      results.push(roll);
      total += roll;
    }

    const fmt = new Intl.NumberFormat("fr-FR");
    const detail = results.map((r) => `\`${r}\``).join(" ");

    const embed = client.embedBuilder
      .base(client, message.t("commands.roll.title"), null)
      .addFields(
        { name: message.t("commands.roll.field_dice"), value: `\`${diceCount}d${diceFaces}\``, inline: true },
        { name: message.t("commands.roll.field_total"), value: `**${fmt.format(total)}**`, inline: true },
        { name: message.t("commands.roll.field_detail"), value: detail, inline: false },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
