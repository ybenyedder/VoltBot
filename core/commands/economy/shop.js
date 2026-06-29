const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  name: "shop",
  aliases: ["store", "magasin", "boutique"],
  description: "Affiche la boutique du serveur.",
  category: "economy",
  usage: "shop",
  async execute(client, message, args) {
    const fmt = new Intl.NumberFormat("fr-FR");
    const guildConfig = client.db.getGuild(message.guild.id) || {};
    const currencyName = guildConfig.currencyName || "Coins";
    const currencyEmoji = guildConfig.currencyEmoji || "";

    let dbItems = client.db.getEconomyShop(message.guild.id);

    if (dbItems.length === 0) {
      dbItems = [
        {
          id: "fixed_vip",
          name: message.t("commands.shop.item_vip_name"),
          description: message.t("commands.shop.item_vip_desc"),
          price: 50000,
        },
        {
          id: "fixed_padlock",
          name: message.t("commands.shop.item_padlock_name"),
          description: message.t("commands.shop.item_padlock_desc"),
          price: 2000,
        },
      ];
    }

    const perPage = 5;
    const pages = [];
    for (let i = 0; i < dbItems.length; i += perPage)
      pages.push(dbItems.slice(i, i + perPage));

    const truncate = (s, n) =>
      !s ? "—" : s.length > n ? s.slice(0, n - 1) + "…" : s;

    const buildEmbed = (pageIdx) => {
      const slice = pages[pageIdx];
      const embed = client.embedBuilder
        .base(client, message.t("commands.shop.title"), null)
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .setFooter({
          text: message.t("commands.shop.page", {
            current: pageIdx + 1,
            total: pages.length,
          }),
        });
      slice.forEach((item) => {
        embed.addFields(
          { name: message.t("commands.shop.field_name"), value: `**${item.name}**`, inline: true },
          {
            name: message.t("commands.shop.field_price", { currency: currencyName }),
            value: `\`${fmt.format(item.price)}\` ${currencyEmoji}`.trim(),
            inline: true,
          },
          {
            name: message.t("commands.shop.field_description"),
            value: truncate(item.description, 80),
            inline: true,
          },
        );
      });
      return embed;
    };

    if (pages.length === 1) {
      return message.reply({ embeds: [buildEmbed(0)] }).catch(() => {});
    }

    let current = 0;
    const buildRow = (idx) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("shop_prev")
          .setLabel(message.t("commands.shop.previous"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(idx === 0),
        new ButtonBuilder()
          .setCustomId("shop_page")
          .setLabel(message.t("commands.shop.page", {
            current: idx + 1,
            total: pages.length,
          }))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("shop_next")
          .setLabel(message.t("commands.shop.next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(idx === pages.length - 1),
      );

    const msg = await message
      .reply({ embeds: [buildEmbed(current)], components: [buildRow(current)] })
      .catch(() => null);
    if (!msg) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "shop_prev" && current > 0) current--;
      else if (i.customId === "shop_next" && current < pages.length - 1)
        current++;
      await i
        .update({
          embeds: [buildEmbed(current)],
          components: [buildRow(current)],
        })
        .catch(() => {});
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
