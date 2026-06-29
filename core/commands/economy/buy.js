const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { localizeItemName } = require("../../utils/itemNames");

module.exports = {
  name: "buy",
  aliases: ["purchase", "acheter"],
  description: "Achète un objet dans la boutique.",
  category: "economy",
  usage: "+buy [id item]",
  async execute(client, message, args) {
    const itemName = args.join(" ").toLowerCase().trim();
    if (!itemName)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.buy.item_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const fmt = new Intl.NumberFormat("fr-FR");

    const dbItems = client.db.getEconomyShop(message.guild.id);
    const defaultItems = [
      {
        id: "fixed_vip",
        name: "Rôle VIP",
        description: "Accès exclusif aux salons secrets.",
        price: 50000,
        roleId: "ROLE_ID_HERE",
      },
      {
        id: "fixed_padlock",
        name: "Cadenas",
        description: "Protège votre porte-monnaie d'un braquage.",
        price: 2000,
      },
    ];

    const item =
      dbItems.find(
        (i) =>
          i.name.toLowerCase() === itemName || i.id?.toString() === itemName,
      ) ||
      defaultItems.find(
        (i) =>
          i.name.toLowerCase() === itemName || i.id.toLowerCase() === itemName,
      );

    if (!item)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.buy.item_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const userData = client.db.getUser(message.author.id, message.guild.id);
    const userCoins = userData?.coins ?? 0;
    if (userCoins < item.price) {
      const missing = item.price - userCoins;
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.buy.insufficient_balance", {
                missing: fmt.format(missing),
                currency:
                  (client.db.getGuild(message.guild.id) || {}).currencyName ||
                  "Coins",
              }),
            ),
          ],
        })
        .catch(() => {});
    }

    // Confirmation pour les achats > 50000
    if (item.price > 50000) {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("buy_confirm")
          .setLabel(message.t("commands.buy.confirm"))
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("buy_cancel")
          .setLabel(message.t("commands.buy.cancel"))
          .setStyle(ButtonStyle.Secondary),
      );
      const confirmEmbed = client.embedBuilder
        .base(client, message.t("commands.buy.confirm_title"), null)
        .addFields(
          {
            name: message.t("commands.buy.field_item"),
            value: `**${localizeItemName(item.name, message.lang)}**`,
            inline: true,
          },
          {
            name: message.t("commands.buy.field_price"),
            value: `\`${fmt.format(item.price)}\``,
            inline: true,
          },
        );
      const confirmMsg = await message
        .reply({ embeds: [confirmEmbed], components: [confirmRow] })
        .catch(() => null);
      if (!confirmMsg) return;

      let decided = false;
      try {
        const i = await confirmMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30000,
          filter: (x) => x.user.id === message.author.id,
        });
        decided = true;
        if (i.customId !== "buy_confirm") {
          await i
            .update({
              embeds: [
                client.embedBuilder.base(
                  client,
                  message.t("commands.buy.purchase_cancelled"),
                  null,
                ),
              ],
              components: [],
            })
            .catch(() => {});
          return;
        }
        await i.deferUpdate().catch(() => {});
      } catch (e) {
        if (!decided) {
          await confirmMsg.edit({ components: [] }).catch(() => {});
          return;
        }
      }

      await finalizePurchase(client, message, item, fmt, confirmMsg);
      return;
    }

    await finalizePurchase(client, message, item, fmt, null);
  },
};

async function finalizePurchase(client, message, item, fmt, confirmMsg) {
  if (
    !client.db.tryRemoveCoins(message.author.id, message.guild.id, item.price)
  ) {
    const userData = client.db.getUser(message.author.id, message.guild.id);
    const missing = item.price - (userData?.coins ?? 0);
    const embed = client.embedBuilder.error(
      client,
      message.t("commands.buy.insufficient_balance", {
        missing: fmt.format(Math.max(missing, 1)),
        currency:
          (client.db.getGuild(message.guild.id) || {}).currencyName || "Coins",
      }),
    );
    if (confirmMsg)
      return confirmMsg
        .edit({ embeds: [embed], components: [] })
        .catch(() => {});
    return message.reply({ embeds: [embed] }).catch(() => {});
  }

  if (item.roleId) {
    const role = message.guild.roles.cache.get(item.roleId);
    if (role) {
      if (message.member.roles.cache.has(role.id)) {
        client.db.addCoins(message.author.id, message.guild.id, item.price);
        const embed = client.embedBuilder.error(
          client,
          message.t("commands.buy.purchase_limit_reached"),
        );
        if (confirmMsg)
          return confirmMsg
            .edit({ embeds: [embed], components: [] })
            .catch(() => {});
        return message.reply({ embeds: [embed] }).catch(() => {});
      }
      try {
        await message.member.roles.add(role);
      } catch (e) {
        client.db.addCoins(message.author.id, message.guild.id, item.price);
        const embed = client.embedBuilder.error(
          client,
          message.t("commands.buy.role_assign_failed"),
        );
        if (confirmMsg)
          return confirmMsg
            .edit({ embeds: [embed], components: [] })
            .catch(() => {});
        return message.reply({ embeds: [embed] }).catch(() => {});
      }
    } else {
      client.db.addCoins(message.author.id, message.guild.id, item.price);
      const embed = client.embedBuilder.error(
        client,
        message.t("commands.buy.role_not_found"),
      );
      if (confirmMsg)
        return confirmMsg
          .edit({ embeds: [embed], components: [] })
          .catch(() => {});
      return message.reply({ embeds: [embed] }).catch(() => {});
    }
  } else {
    try {
      client.db.addItem(message.author.id, message.guild.id, item.name, 1);
    } catch (e) {
      /* ignore */
    }
  }

  const updated = client.db.getUser(message.author.id, message.guild.id);
  const balance = updated?.coins ?? 0;

  const embed = client.embedBuilder
    .base(client, message.t("commands.buy.purchase_confirmed"), null)
    .addFields(
      {
        name: message.t("commands.buy.field_item"),
        value: `**${localizeItemName(item.name, message.lang)}**`,
        inline: true,
      },
      {
        name: message.t("commands.buy.field_price"),
        value: `\`${fmt.format(item.price)}\``,
        inline: true,
      },
      {
        name: message.t("commands.buy.field_remaining_balance"),
        value: `\`${fmt.format(balance)}\``,
        inline: true,
      },
    );

  if (confirmMsg)
    return confirmMsg.edit({ embeds: [embed], components: [] }).catch(() => {});
  return message.reply({ embeds: [embed] }).catch(() => {});
}
