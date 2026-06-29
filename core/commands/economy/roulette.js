module.exports = {
  name: "roulette",
  aliases: ["rl"],
  description: "Pariez vos pièces sur la roulette.",
  category: "economy",
  usage: "+roulette <mise> <noir|rouge|vert>",
  cooldown: 5,
  async execute(client, message, args) {
    const { checkCasinoLevel } = require("../../utils/casino.js");
    if (!(await checkCasinoLevel(client, message))) return;

    const fmt = new Intl.NumberFormat("fr-FR");
    const coin = client.config.emojis.coin || "";

    const bet = parseInt(args[0]);
    const colorInput = args[1]?.toLowerCase();
    if (isNaN(bet) || bet <= 0)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.roulette.invalid_bet"),
            ),
          ],
        })
        .catch(() => {});
    if (
      !["noir", "rouge", "vert", "black", "red", "green"].includes(colorInput)
    ) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.roulette.invalid_color"),
            ),
          ],
        })
        .catch(() => {});
    }

    let color = colorInput;
    if (color === "noir") color = "black";
    if (color === "rouge") color = "red";
    if (color === "vert") color = "green";

    const labelFr = {
      black: message.t("commands.roulette.color_black"),
      red: message.t("commands.roulette.color_red"),
      green: message.t("commands.roulette.color_green"),
    };

    const userData = client.db.getUser(message.author.id, message.guild.id);
    const available = userData.coins || 0;
    if (!client.db.tryRemoveCoins(message.author.id, message.guild.id, bet)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.roulette.insufficient_balance", {
                available: fmt.format(available),
              }),
            ),
          ],
        })
        .catch(() => {});
    }

    let rand = Math.floor(Math.random() * 37);
    const luckyCharm = client.db.db
      .prepare(
        "SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
      )
      .get(message.author.id, message.guild.id, "lucky_charm");
    if (luckyCharm && luckyCharm.amount > 0 && Math.random() > 0.7) {
      if (color === "black") rand = (Math.floor(Math.random() * 18) + 1) * 2;
      else if (color === "red") rand = Math.floor(Math.random() * 18) * 2 + 1;
    }

    const resultColor = rand === 0 ? "green" : rand % 2 === 0 ? "black" : "red";

    const balanceAfter = () => {
      const u = client.db.getUser(message.author.id, message.guild.id);
      return u.coins || 0;
    };

    const wheel = (slot) => `\`\`\`prolog\n[ ${slot} ]\n\`\`\``;

    const spinEmbed = (slot) =>
      client.embedBuilder
        .base(client, message.t("commands.roulette.title"), null)
        .addFields(
          {
            name: message.t("commands.roulette.field_bet"),
            value: `**${fmt.format(bet)}** ${coin}`,
            inline: true,
          },
          {
            name: message.t("commands.roulette.field_wager"),
            value: `**${labelFr[color]}**`,
            inline: true,
          },
          {
            name: message.t("commands.roulette.field_remaining_balance"),
            value: `**${fmt.format(balanceAfter())}** ${coin}`,
            inline: true,
          },
          {
            name: message.t("commands.roulette.field_wheel"),
            value: wheel(slot),
            inline: false,
          },
        );

    const msg = await message
      .reply({ embeds: [spinEmbed("...")] })
      .catch(() => null);
    if (!msg) return;

    await new Promise((r) => setTimeout(r, 700));
    await msg.edit({ embeds: [spinEmbed(". . .")] }).catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    await msg.edit({ embeds: [spinEmbed(". . . .")] }).catch(() => {});
    await new Promise((r) => setTimeout(r, 700));

    let net;
    let helper;
    if (color === resultColor) {
      const multiplier = resultColor === "green" ? 14 : 2;
      const winnings = bet * multiplier;
      client.db.addCoins(message.author.id, message.guild.id, winnings);
      net = winnings - bet;
      helper = client.embedBuilder.success;
    } else {
      net = -bet;
      helper = client.embedBuilder.error;
    }
    const signed = `${net >= 0 ? "+" : ""}${fmt.format(net)}`;
    const label =
      net >= 0
        ? message.t("commands.roulette.result_won")
        : message.t("commands.roulette.result_lost");

    const finalEmbed = helper(
      client,
      message.t("commands.roulette.final_title", { result: label }),
    ).addFields(
      {
        name: message.t("commands.roulette.field_number"),
        value: `**${rand}**`,
        inline: true,
      },
      {
        name: message.t("commands.roulette.field_color"),
        value: `**${labelFr[resultColor]}**`,
        inline: true,
      },
      {
        name: message.t("commands.roulette.field_result"),
        value: `**${label}**`,
        inline: true,
      },
      {
        name: message.t("commands.roulette.field_net_gain"),
        value: `**${signed}** ${coin}`,
        inline: true,
      },
      {
        name: message.t("commands.roulette.field_balance"),
        value: `**${fmt.format(balanceAfter())}** ${coin}`,
        inline: true,
      },
    );

    await msg.edit({ embeds: [finalEmbed] }).catch(() => {});
  },
};
