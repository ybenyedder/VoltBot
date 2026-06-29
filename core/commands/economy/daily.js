module.exports = {
  name: "daily",
  aliases: ["reward", "jour", "bonus"],
  description: "Récupère ta récompense quotidienne.",
  category: "economy",
  usage: "daily",
  async execute(client, message, args) {
    const user = client.db.getUser(message.author.id, message.guild.id);
    const config = client.db.getGuild(message.guild.id);
    const min = config.minDaily || 200;
    const max = config.maxDaily || 1000;
    const fmt = new Intl.NumberFormat("fr-FR");

    const cooldown = 86400000;
    const daily = user.dailyTimestamp;

    if (daily !== null && cooldown - (Date.now() - daily) > 0) {
      const readyAt = Math.floor((daily + cooldown) / 1000);
      const embed = client.embedBuilder
        .warning(client, message.t("commands.daily.already_claimed"))
        .addFields({
          name: message.t("commands.daily.field_returns"),
          value: `<t:${readyAt}:R>`,
          inline: true,
        });
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    client.db.addCoins(message.author.id, message.guild.id, amount);
    client.db.updateUser(message.author.id, message.guild.id, {
      dailyTimestamp: Date.now(),
    });

    const updated = client.db.getUser(message.author.id, message.guild.id);
    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.daily.field_earnings"),
          value: `\`\`\`prolog\n${fmt.format(amount)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.daily.field_balance"),
          value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
          inline: true,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
