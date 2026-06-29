module.exports = {
  name: "coinflip",
  aliases: ["pileouface", "cf"],
  description: "Parie ton argent sur Pile ou Face.",
  category: "fun",
  usage: "+coinflip [mise] [pile/face]",
  async execute(client, message, args) {
    const bet = parseInt(args[0]);
    const choice = args[1]?.toLowerCase();

    if (isNaN(bet) || bet <= 0)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.coinflip.invalid_bet"),
            ),
          ],
        })
        .catch(() => {});
    if (!["pile", "face"].includes(choice))
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.coinflip.choose_side")),
          ],
        })
        .catch(() => {});

    const userStats = client.db.getUser(message.author.id, message.guild.id);
    if (userStats.coins < bet)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.coinflip.insufficient_balance"))],
        })
        .catch(() => {});

    const result = Math.random() < 0.5 ? "pile" : "face";
    const resultText =
      result === "pile"
        ? message.t("commands.coinflip.heads")
        : message.t("commands.coinflip.tails");
    const win = choice === result;
    const fmt = new Intl.NumberFormat("fr-FR");

    if (win) {
      client.db.addCoins(message.author.id, message.guild.id, bet);
    } else {
      client.db.addCoins(message.author.id, message.guild.id, -bet);
    }

    const helper = win
      ? client.embedBuilder.success
      : client.embedBuilder.error;
    const embed = helper(client, message.t("commands.coinflip.title")).addFields(
      { name: message.t("commands.coinflip.result"), value: `**${resultText}**`, inline: true },
      {
        name: message.t("commands.coinflip.choice"),
        value:
          choice === "pile"
            ? message.t("commands.coinflip.heads")
            : message.t("commands.coinflip.tails"),
        inline: true,
      },
      {
        name: message.t("commands.coinflip.gain"),
        value: win ? `**+${fmt.format(bet)}**` : `**-${fmt.format(bet)}**`,
        inline: true,
      },
    );

    await message.reply({ embeds: [embed] }).catch(() => {});
  },
};
