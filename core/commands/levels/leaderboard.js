const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const PAGE_SIZE = 10;
const nfFr = new Intl.NumberFormat("fr-FR");

const ordinal = (n) => (n === 1 ? "1er" : `${nfFr.format(n)}e`);

const buildEmbed = (client, message, data, page, type) => {
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = data.slice(start, start + PAGE_SIZE);

  const authorName =
    type === "xp"
      ? message.t("commands.leaderboard.title_xp")
      : message.t("commands.leaderboard.title_eco");

  const lines = slice.map((userDb, i) => {
    const rank = start + i + 1;
    const rankCell = `\`${ordinal(rank).padStart(4)}\``;
    let line;
    if (type === "xp") {
      line = message.t("commands.leaderboard.line_xp", {
        rank: rankCell,
        user: `<@${userDb.userId}>`,
        level: nfFr.format(userDb.level),
        xp: nfFr.format(userDb.xp),
      });
    } else {
      const wealth = userDb.coins + userDb.bank;
      line = message.t("commands.leaderboard.line_eco", {
        rank: rankCell,
        user: `<@${userDb.userId}>`,
        wealth: nfFr.format(wealth),
        coin: client.config.emojis.coin,
      });
    }
    // Top 3 get bold rank, self gets bold full line
    if (userDb.userId === message.author.id) return `**${line}**`;
    if (rank <= 3) return line.replace(rankCell, `**${rankCell}**`);
    return line;
  });

  // Find author's own rank to surface in footer
  const myIdx = data.findIndex((u) => u.userId === message.author.id);
  const myRank = myIdx >= 0 ? ordinal(myIdx + 1) : null;

  const footerParts = [
    message.t("commands.leaderboard.footer_page", {
      page: nfFr.format(page + 1),
      totalPages: nfFr.format(totalPages),
    }),
    message.t("commands.leaderboard.footer_members", {
      count: nfFr.format(data.length),
    }),
  ];
  if (myRank)
    footerParts.push(
      message.t("commands.leaderboard.footer_you", { rank: myRank }),
    );

  return client.embedBuilder
    .premium(client, authorName, lines.join("\n"))
    .setAuthor({
      name: message.t("commands.leaderboard.author", {
        title: authorName,
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

const buildRow = (message, page, totalPages, disabled = false) => {
  const showExtremes = totalPages > 5;
  const row = new ActionRowBuilder();

  if (showExtremes) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("lb_first")
        .setLabel("«")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page === 0),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("lb_prev")
      .setLabel(message.t("commands.leaderboard.btn_prev"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId("lb_page")
      .setLabel(
        message.t("commands.leaderboard.btn_page", {
          page: page + 1,
          totalPages,
        }),
      )
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("lb_next")
      .setLabel(message.t("commands.leaderboard.btn_next"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || page >= totalPages - 1),
  );

  if (showExtremes) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("lb_last")
        .setLabel("»")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page >= totalPages - 1),
    );
  }

  return row;
};

module.exports = {
  name: "leaderboard",
  aliases: ["lb", "top"],
  description: "Affiche le classement du serveur (XP ou Economie).",
  category: "levels",
  usage: "+leaderboard [eco]",
  async execute(client, message, args) {
    const type = args[0] && args[0].toLowerCase() === "eco" ? "eco" : "xp";

    const data =
      type === "xp"
        ? client.db.db
            .prepare("SELECT * FROM users WHERE guildId = ? ORDER BY xp DESC")
            .all(message.guild.id)
        : client.db.db
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
              message.t("commands.leaderboard.empty"),
            ),
          ],
        })
        .catch(() => {});
    }

    let page = 0;
    const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));

    const payload = {
      embeds: [buildEmbed(client, message, data, page, type)],
      components: totalPages > 1 ? [buildRow(message, page, totalPages)] : [],
    };

    const sent = await message.reply(payload).catch(() => null);
    if (!sent || totalPages <= 1) return;

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "lb_first") page = 0;
      else if (interaction.customId === "lb_prev") page = Math.max(0, page - 1);
      else if (interaction.customId === "lb_next")
        page = Math.min(totalPages - 1, page + 1);
      else if (interaction.customId === "lb_last") page = totalPages - 1;

      await interaction
        .update({
          embeds: [buildEmbed(client, message, data, page, type)],
          components: [buildRow(message, page, totalPages)],
        })
        .catch(() => {});
    });

    collector.on("end", () => {
      sent
        .edit({ components: [buildRow(message, page, totalPages, true)] })
        .catch(() => {});
    });
  },
};
