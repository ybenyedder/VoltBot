module.exports = {
  name: "slots",
  aliases: ["slot", "machine"],
  description: "Jouez à la machine à sous avec vos pièces.",
  category: "economy",
  usage: "+slots <mise>",
  cooldown: 5,
  async execute(client, message, args) {
    const { checkCasinoLevel } = require("../../utils/casino.js");
    if (!(await checkCasinoLevel(client, message))) return;

    const fmt = new Intl.NumberFormat("fr-FR");
    const coin = client.config.emojis.coin || "";

    const bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0)
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.slots.invalid_bet"))],
        })
        .catch(() => {});

    const userData = client.db.getUser(message.author.id, message.guild.id);
    const available = userData.coins || 0;
    if (!client.db.tryRemoveCoins(message.author.id, message.guild.id, bet)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.slots.insufficient", { available: fmt.format(available) }),
            ),
          ],
        })
        .catch(() => {});
    }

    const symbols = [
      message.t("commands.slots.symbol_red"),
      message.t("commands.slots.symbol_bar"),
      message.t("commands.slots.symbol_seven"),
      message.t("commands.slots.symbol_bell"),
      message.t("commands.slots.symbol_plum"),
      message.t("commands.slots.symbol_cherry"),
    ];
    const pick = () => symbols[Math.floor(Math.random() * symbols.length)];
    const slot1 = pick();
    let slot2 = pick();
    const slot3 = pick();

    const luckyCharm = client.db.db
      .prepare(
        "SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND item = ?",
      )
      .get(message.author.id, message.guild.id, "lucky_charm");
    if (luckyCharm && luckyCharm.amount > 0 && Math.random() > 0.6)
      slot2 = slot1;

    const balanceAfter = () => {
      const u = client.db.getUser(message.author.id, message.guild.id);
      return u.coins || 0;
    };

    const reel = (a, b, c) => `\`\`\`prolog\n[ ${a} | ${b} | ${c} ]\n\`\`\``;

    const preEmbed = client.embedBuilder
      .base(client, message.t("commands.slots.title"), null)
      .addFields(
        { name: message.t("commands.slots.field_bet"), value: `**${fmt.format(bet)}** ${coin}`, inline: true },
        {
          name: message.t("commands.slots.field_balance_left"),
          value: `**${fmt.format(balanceAfter())}** ${coin}`,
          inline: true,
        },
        {
          name: message.t("commands.slots.field_reels"),
          value: reel("???", "???", "???"),
          inline: false,
        },
      );

    const msg = await message.reply({ embeds: [preEmbed] }).catch(() => null);
    if (!msg) return;

    const editReel = (a, b, c) =>
      msg
        .edit({
          embeds: [
            client.embedBuilder.base(client, message.t("commands.slots.title"), null).addFields(
              {
                name: message.t("commands.slots.field_bet"),
                value: `**${fmt.format(bet)}** ${coin}`,
                inline: true,
              },
              {
                name: message.t("commands.slots.field_balance_left"),
                value: `**${fmt.format(balanceAfter())}** ${coin}`,
                inline: true,
              },
              {
                name: message.t("commands.slots.field_reels"),
                value: reel(a, b, c),
                inline: false,
              },
            ),
          ],
        })
        .catch(() => {});

    await new Promise((r) => setTimeout(r, 650));
    await editReel(slot1, "???", "???");
    await new Promise((r) => setTimeout(r, 650));
    await editReel(slot1, slot2, "???");
    await new Promise((r) => setTimeout(r, 650));

    let net;
    let won = false;
    if (slot1 === slot2 && slot2 === slot3) {
      const winnings = bet * 5;
      client.db.addCoins(message.author.id, message.guild.id, winnings);
      net = winnings - bet;
      won = true;
    } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
      const winnings = bet * 2;
      client.db.addCoins(message.author.id, message.guild.id, winnings);
      net = winnings - bet;
      won = true;
    } else {
      net = -bet;
    }

    const helper = won
      ? client.embedBuilder.success
      : client.embedBuilder.error;
    const label = won
      ? net === bet * 4
        ? message.t("commands.slots.label_jackpot")
        : message.t("commands.slots.label_won")
      : message.t("commands.slots.label_lost");
    const signed = `${net >= 0 ? "+" : ""}${fmt.format(net)}`;

    const finalEmbed = helper(client, message.t("commands.slots.result_title", { label })).addFields(
      {
        name: message.t("commands.slots.field_reels"),
        value: reel(slot1, slot2, slot3),
        inline: false,
      },
      { name: message.t("commands.slots.field_result"), value: `**${label}**`, inline: true },
      { name: message.t("commands.slots.field_net_gain"), value: `**${signed}** ${coin}`, inline: true },
      {
        name: message.t("commands.slots.field_balance"),
        value: `**${fmt.format(balanceAfter())}** ${coin}`,
        inline: true,
      },
    );

    await msg.edit({ embeds: [finalEmbed] }).catch(() => {});
  },
};
