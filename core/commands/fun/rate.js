module.exports = {
  name: "rate",
  description: "Note quelque chose sur 100.",
  category: "fun",
  usage: "+rate [sujet]",
  async execute(client, message, args) {
    if (!args[0])
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.rate.need_subject"))],
        })
        .catch(() => {});

    const subject = args.join(" ");
    const rating = Math.floor(Math.random() * 101);

    let remark;
    if (rating < 25) remark = message.t("commands.rate.verdict_mediocre");
    else if (rating < 50) remark = message.t("commands.rate.verdict_meh");
    else if (rating < 75) remark = message.t("commands.rate.verdict_ok");
    else if (rating < 100) remark = message.t("commands.rate.verdict_solid");
    else remark = message.t("commands.rate.verdict_flawless");

    const filled = Math.round(rating / 10);
    const bar =
      "[" + "█".repeat(filled) + "░".repeat(10 - filled) + `] ${rating}%`;

    const embed = client.embedBuilder
      .base(client, message.t("commands.rate.title"), null)
      .addFields(
        { name: message.t("commands.rate.field_subject"), value: `\`${subject}\``, inline: true },
        { name: message.t("commands.rate.field_rating"), value: `**${rating} / 100**`, inline: true },
        { name: message.t("commands.rate.field_verdict"), value: remark, inline: true },
        { name: message.t("commands.rate.field_gauge"), value: `\`${bar}\``, inline: false },
      );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
