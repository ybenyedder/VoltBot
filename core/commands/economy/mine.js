module.exports = {
  name: "mine",
  aliases: ["mining", "minage"],
  description: "Partez à la mine pour trouver des minerais précieux.",
  category: "economy",
  cooldown: 180,
  usage: "+mine",
  async execute(client, message, args) {
    const ores = [
      { name: "Pierre", chance: 50, value: 5 },
      { name: "Charbon", chance: 30, value: 15 },
      { name: "Fer", chance: 15, value: 50 },
      { name: "Or", chance: 4, value: 200 },
      { name: "Diamant", chance: 1, value: 1000 },
    ];
    const rand = Math.random() * 100;
    let earnedOre = ores[0],
      cumulated = 0;
    for (const ore of ores) {
      cumulated += ore.chance;
      if (rand <= cumulated) {
        earnedOre = ore;
        break;
      }
    }
    // Atomic item+coins combo so a crash between the two writes can't leave
    // the inventory and balance out of sync.
    client.db.addItemAndCoins(
      message.author.id,
      message.guild.id,
      earnedOre.name,
      1,
      earnedOre.value,
    );

    const fmt = new Intl.NumberFormat("fr-FR");
    const updated = client.db.getUser(message.author.id, message.guild.id);

    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.mine.field_ore"),
          value: `\`${earnedOre.name}\``,
          inline: true,
        },
        {
          name: message.t("commands.mine.field_earnings"),
          value: `\`\`\`prolog\n${fmt.format(earnedOre.value)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.mine.field_balance"),
          value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
          inline: true,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
