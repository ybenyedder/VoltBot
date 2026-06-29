const { localizeItemName } = require("../../utils/itemNames");

module.exports = {
  name: "fish",
  aliases: ["fishing", "peche"],
  description: "Allez pêcher pour attraper des poissons rares.",
  category: "economy",
  cooldown: 180,
  usage: "+fish",
  async execute(client, message, args) {
    const fishes = [
      { name: "Poisson commun", chance: 50, value: 10 },
      { name: "Saumon", chance: 30, value: 30 },
      { name: "Poisson Tropical", chance: 15, value: 80 },
      { name: "Requin", chance: 4, value: 300 },
      { name: "Coffre Trésor", chance: 1, value: 1500 },
    ];
    const rand = Math.random() * 100;
    let earnedFish = fishes[0],
      cumulated = 0;
    for (const fish of fishes) {
      cumulated += fish.chance;
      if (rand <= cumulated) {
        earnedFish = fish;
        break;
      }
    }
    // Atomic item+coins combo replaces the prior SELECT-then-INSERT/UPDATE +
    // separate addCoins call, which had two races: duplicate inventory rows
    // for the same (user, item) and partial state on crash.
    client.db.addItemAndCoins(
      message.author.id,
      message.guild.id,
      earnedFish.name,
      1,
      earnedFish.value,
    );

    const fmt = new Intl.NumberFormat("fr-FR");
    const updated = client.db.getUser(message.author.id, message.guild.id);

    const embed = client.embedBuilder
      .success(client, "")
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.fish.field_catch"),
          value: `\`${localizeItemName(earnedFish.name, message.lang)}\``,
          inline: true,
        },
        {
          name: message.t("commands.fish.field_earnings"),
          value: `\`\`\`prolog\n${fmt.format(earnedFish.value)}\n\`\`\``,
          inline: true,
        },
        {
          name: message.t("commands.fish.field_balance"),
          value: `\`\`\`prolog\n${fmt.format(updated.coins || 0)}\n\`\`\``,
          inline: true,
        },
      );
    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
