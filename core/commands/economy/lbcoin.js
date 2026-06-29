const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const PER_PAGE = 10;

const ordinal = (n) => (n === 1 ? "1er" : `${n}e`);

module.exports = {
  name: "lbcoin",
  aliases: ["coinlb", "moneylb", "topcoin"],
  description: "Affiche le classement des membres les plus riches du serveur.",
  category: "economy",
  usage: "+lbcoin",
  async execute(client, message, args) {
    const data = client.db.db
      .prepare(
        "SELECT *, (coins + bank) as totalWealth FROM users WHERE guildId = ? ORDER BY totalWealth DESC",
      )
      .all(message.guild.id);

    if (!data || data.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.lbcoin.no_data"),
            ),
          ],
        })
        .catch(() => {});
    }

    const fmt = new Intl.NumberFormat("fr-FR");
    const totalPages = Math.max(1, Math.ceil(data.length / PER_PAGE));

    const myIdx = data.findIndex((u) => u.userId === message.author.id);
    const myRank = myIdx >= 0 ? ordinal(myIdx + 1) : null;
    const coinEmoji = client.config.emojis?.coin || "coins";

    const buildEmbed = (page) => {
      const start = page * PER_PAGE;
      const slice = data.slice(start, start + PER_PAGE);
      const lines = slice
        .map((u, i) => {
          const rank = start + i + 1;
          const wealth = (u.coins || 0) + (u.bank || 0);
          const rankCell = `\`${ordinal(rank).padStart(4)}\``;
          const base = `${rankCell} · <@${u.userId}> · **${fmt.format(wealth)}** ${coinEmoji}`;
          if (u.userId === message.author.id) return `**${base}**`;
          if (rank <= 3) return base.replace(rankCell, `**${rankCell}**`);
          return base;
        })
        .join("\n");

      const footerParts = [
        message.t("commands.lbcoin.page", {
          current: page + 1,
          total: totalPages,
        }),
        message.t("commands.lbcoin.members_count", {
          count: fmt.format(data.length),
        }),
      ];
      if (myRank)
        footerParts.push(message.t("commands.lbcoin.you", { rank: myRank }));

      return client.embedBuilder
        .premium(client, message.t("commands.lbcoin.title"), lines)
        .setAuthor({
          name: message.t("commands.lbcoin.author", {
            guild: message.guild.name,
          }),
          iconURL: message.guild.iconURL({ size: 64 }) || undefined,
        })
        .setThumbnail(message.guild.iconURL({ size: 256 }))
        .setFooter({
          text: footerParts.join(" · "),
          iconURL: message.guild.iconURL({ size: 64 }) || undefined,
        });
    };

    const buildRow = (page, disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("lb_prev")
          .setLabel(message.t("commands.lbcoin.previous"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === 0),
        new ButtonBuilder()
          .setCustomId("lb_page")
          .setLabel(
            message.t("commands.lbcoin.page", {
              current: page + 1,
              total: totalPages,
            }),
          )
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("lb_next")
          .setLabel(message.t("commands.lbcoin.next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page >= totalPages - 1),
      );

    let page = 0;
    const replyOpts = { embeds: [buildEmbed(page)] };
    if (totalPages > 1) replyOpts.components = [buildRow(page)];
    const sent = await message.reply(replyOpts).catch(() => null);
    if (!sent || totalPages <= 1) return;

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "lb_prev") page = Math.max(0, page - 1);
      else if (i.customId === "lb_next")
        page = Math.min(totalPages - 1, page + 1);
      await i
        .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
        .catch(() => {});
    });

    collector.on("end", () => {
      sent.edit({ components: [buildRow(page, true)] }).catch(() => {});
    });
  },
};
