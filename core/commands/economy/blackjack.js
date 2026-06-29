const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  name: "blackjack",
  aliases: ["bj", "cards", "21"],
  description: "Jouez au blackjack pour gagner des pièces.",
  category: "economy",
  usage: "+blackjack <mise>",
  cooldown: 10,
  async execute(client, message, args) {
    const { checkCasinoLevel } = require("../../utils/casino.js");
    if (!(await checkCasinoLevel(client, message))) return;

    const fmt = new Intl.NumberFormat("fr-FR");
    const coin = client.config.emojis.coin || "";

    const miseStr = args[0];
    if (!miseStr || isNaN(miseStr) || parseInt(miseStr) <= 0) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.blackjack.invalid_bet"))],
        })
        .catch(() => {});
    }
    const mise = parseInt(miseStr);

    const userData = client.db.getUser(message.author.id, message.guild.id);
    const available = userData.coins || 0;
    if (!client.db.tryRemoveCoins(message.author.id, message.guild.id, mise)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.blackjack.insufficient_balance", { available: fmt.format(available) }),
            ),
          ],
        })
        .catch(() => {});
    }

    const suits = ["S", "H", "D", "C"];
    const values = [
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
      "A",
    ];

    const getDeck = () => {
      const deck = [];
      for (const s of suits) {
        for (const v of values) {
          let w = parseInt(v) || 10;
          if (v === "A") w = 11;
          deck.push({ v, s, w });
        }
      }
      return deck.sort(() => Math.random() - 0.5);
    };

    const deck = getDeck();
    const safePop = () =>
      deck.length > 0 ? deck.pop() : { v: "0", s: "?", w: 0 };
    const playerHand = [safePop(), safePop()];
    const dealerHand = [safePop(), safePop()];

    const calcTotal = (cards) => {
      let total = cards.reduce((sum, c) => sum + c.w, 0);
      let aces = cards.filter((c) => c.v === "A").length;
      while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
      }
      return total;
    };

    const fmtCards = (cards) => cards.map((c) => `${c.v}${c.s}`).join(" ");

    const balanceLeft = () => {
      const u = client.db.getUser(message.author.id, message.guild.id);
      return u.coins || 0;
    };

    const buildPlayingEmbed = (revealDealer = false) => {
      const pTotal = calcTotal(playerHand);
      const dTotal = revealDealer ? calcTotal(dealerHand) : dealerHand[0].w;
      const dCards = revealDealer
        ? fmtCards(dealerHand)
        : `${dealerHand[0].v}${dealerHand[0].s} ??`;
      return client.embedBuilder.base(client, "Blackjack", null).addFields(
        {
          name: message.t("commands.blackjack.field_your_cards"),
          value: `\`\`\`prolog\n${fmtCards(playerHand)}\n\`\`\``,
          inline: false,
        },
        { name: message.t("commands.blackjack.field_score"), value: `**${pTotal}**`, inline: true },
        { name: message.t("commands.blackjack.field_dealer"), value: `\`${dCards}\` (${dTotal})`, inline: true },
        {
          name: message.t("commands.blackjack.field_bet"),
          value: `**${fmt.format(mise)}** ${coin}`,
          inline: true,
        },
      );
    };

    const buildResultEmbed = (status, netGain) => {
      const pTotal = calcTotal(playerHand);
      const dTotal = calcTotal(dealerHand);
      const label =
        status === "WIN"
          ? message.t("commands.blackjack.result_win")
          : status === "TIE"
            ? message.t("commands.blackjack.result_tie")
            : message.t("commands.blackjack.result_lose");
      const helper =
        status === "LOSE"
          ? client.embedBuilder.error
          : client.embedBuilder.success;
      const signed = `${netGain >= 0 ? "+" : ""}${fmt.format(netGain)}`;
      return helper(client, message.t("commands.blackjack.result_title", { label })).addFields(
        {
          name: message.t("commands.blackjack.field_your_cards"),
          value: `\`\`\`prolog\n${fmtCards(playerHand)} (${pTotal})\n\`\`\``,
          inline: false,
        },
        {
          name: message.t("commands.blackjack.field_dealer"),
          value: `\`\`\`prolog\n${fmtCards(dealerHand)} (${dTotal})\n\`\`\``,
          inline: false,
        },
        { name: message.t("commands.blackjack.field_result"), value: `**${label}**`, inline: true },
        { name: message.t("commands.blackjack.field_net_gain"), value: `**${signed}** ${coin}`, inline: true },
        {
          name: message.t("commands.blackjack.field_balance"),
          value: `**${fmt.format(balanceLeft())}** ${coin}`,
          inline: true,
        },
      );
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("bj_hit")
        .setLabel(message.t("commands.blackjack.btn_hit"))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("bj_stand")
        .setLabel(message.t("commands.blackjack.btn_stand"))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("bj_double")
        .setLabel(message.t("commands.blackjack.btn_double"))
        .setStyle(ButtonStyle.Success),
    );

    const msg = await message
      .reply({ embeds: [buildPlayingEmbed()], components: [row] })
      .catch(() => null);
    if (!msg) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
      filter: (i) => i.user.id === message.author.id,
    });

    let currentMise = mise;
    let doubled = false;

    const settleStand = async (i) => {
      let dTotal = calcTotal(dealerHand);
      while (dTotal < 17) {
        dealerHand.push(safePop());
        dTotal = calcTotal(dealerHand);
      }
      const pTotal = calcTotal(playerHand);
      let status;
      let net;
      if (dTotal > 21 || pTotal > dTotal) {
        client.db.addCoins(
          message.author.id,
          message.guild.id,
          currentMise * 2,
        );
        status = "WIN";
        net = currentMise;
      } else if (pTotal < dTotal) {
        status = "LOSE";
        net = -currentMise;
      } else {
        client.db.addCoins(message.author.id, message.guild.id, currentMise);
        status = "TIE";
        net = 0;
      }
      collector.stop("stand");
      return i
        .update({ embeds: [buildResultEmbed(status, net)], components: [] })
        .catch(() => {});
    };

    collector.on("collect", async (i) => {
      if (i.customId === "bj_hit") {
        playerHand.push(safePop());
        if (calcTotal(playerHand) > 21) {
          collector.stop("bust");
          return i
            .update({
              embeds: [buildResultEmbed("LOSE", -currentMise)],
              components: [],
            })
            .catch(() => {});
        }
        return i.update({ embeds: [buildPlayingEmbed()] }).catch(() => {});
      }
      if (i.customId === "bj_double") {
        if (doubled || playerHand.length > 2) {
          return i.deferUpdate().catch(() => {});
        }
        const extra = client.db.tryRemoveCoins(
          message.author.id,
          message.guild.id,
          mise,
        );
        if (!extra) {
          return i.deferUpdate().catch(() => {});
        }
        doubled = true;
        currentMise = mise * 2;
        playerHand.push(safePop());
        if (calcTotal(playerHand) > 21) {
          collector.stop("bust");
          return i
            .update({
              embeds: [buildResultEmbed("LOSE", -currentMise)],
              components: [],
            })
            .catch(() => {});
        }
        return settleStand(i);
      }
      if (i.customId === "bj_stand") {
        return settleStand(i);
      }
    });

    collector.on("end", (_, reason) => {
      if (reason === "time") {
        msg
          .edit({
            embeds: [buildResultEmbed("LOSE", -currentMise)],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
