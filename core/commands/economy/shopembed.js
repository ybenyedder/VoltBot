const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");

module.exports = {
  name: "shopembed",
  description: "Déploie un embed de boutique interactif.",
  category: "economy",
  usage: "shopembed",
  userPerms: ["Administrator"],
  async execute(client, message, args) {
    const guildConfig = client.db.getGuild(message.guild.id) || {};
    const currencyName = guildConfig.currencyName || "Coins";
    const items = client.db.getEconomyShop(message.guild.id);

    if (items.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.shopembed.empty"),
            ),
          ],
        })
        .catch(() => {});
    }

    const fmt = new Intl.NumberFormat("fr-FR");
    const truncate = (s, n) =>
      !s ? "" : s.length > n ? s.slice(0, n - 1) + "…" : s;

    const embed = client.embedBuilder
      .base(client, message.t("commands.shopembed.title"), message.t("commands.shopembed.select_prompt"))
      .setThumbnail(message.guild.iconURL({ dynamic: true }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("shop_buy_select")
      .setPlaceholder(message.t("commands.shopembed.placeholder"))
      .addOptions(
        items.slice(0, 25).map((item) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(truncate(item.name, 100))
            .setDescription(truncate(`${fmt.format(item.price)} ${currencyName}`, 100))
            .setValue(`shop_item_${item.id}`),
        ),
      );

    await message.channel
      .send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(selectMenu)],
      })
      .catch(() => {});
    await message.delete().catch(() => {});
  },
};
