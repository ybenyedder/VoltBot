module.exports = {
  name: "crime",
  aliases: ["heist", "illegal"],
  description: "Tente un crime pour gagner beaucoup (mais avec des risques).",
  category: "economy",
  usage: "crime",
  cooldown: 7200,
  async execute(client, message, args) {
    const fmt = new Intl.NumberFormat("fr-FR");
    const isSuccess = Math.floor(Math.random() * 100) < 40;

    if (isSuccess) {
      const earnings = Math.floor(Math.random() * 800) + 200;
      client.db.addCoins(message.author.id, message.guild.id, earnings);
      const updated = client.db.getUser(message.author.id, message.guild.id);
      const embed = client.embedBuilder
        .success(client, "")
        .setDescription(null)
        .addFields(
          {
            name: message.t("commands.crime.field_earnings"),
            value: `\`\`\`prolog\n${fmt.format(earnings)}\n\`\`\``,
            inline: true,
          },
          {
            name: message.t("commands.crime.field_balance"),
            value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const fine = Math.floor(Math.random() * 300) + 100;
    client.db.removeCoins(message.author.id, message.guild.id, fine);
    const updated = client.db.getUser(message.author.id, message.guild.id);
    const embed = client.embedBuilder
      .error(client, "")
      .setDescription(message.t("commands.crime.caught_by_police"))
      .addFields(
        {
          name: message.t("commands.crime.field_fine"),
          value: `\`\`\`prolog\n${fmt.format(fine)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.crime.field_balance"),
          value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
          inline: true,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
