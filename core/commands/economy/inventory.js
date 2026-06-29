const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { localizeItemName } = require("../../utils/itemNames");

module.exports = {
  name: "inventory",
  aliases: ["inv", "items", "sac"],
  description: "Affiche l'inventaire d'un joueur.",
  category: "economy",
  usage: "+inventory [@user]",
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;
    if (target.user.bot)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.inventory.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const inventory = client.db.db
      .prepare("SELECT * FROM inventory WHERE userId = ? AND guildId = ?")
      .all(target.id, message.guild.id);
    if (!inventory || inventory.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.inventory.empty", { target }),
            ),
          ],
        })
        .catch(() => {});
    }

    const itemsMeta = [
      { id: "vip", name: "Rôle VIP" },
      { id: "padlock", name: "Cadenas" },
      { id: "lucky_charm", name: "Trèfle à quatre feuilles" },
    ];

    const perPage = 8;
    const pages = [];
    for (let i = 0; i < inventory.length; i += perPage)
      pages.push(inventory.slice(i, i + perPage));

    const authorLabel = message.t("commands.inventory.author_label", {
      user: target.user.username,
    });

    const buildEmbed = (pageIdx) => {
      const slice = pages[pageIdx];
      const embed = client.embedBuilder
        .base(client, authorLabel, null)
        .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
        .setFooter({
          text: message.t("commands.inventory.page", {
            current: pageIdx + 1,
            total: pages.length,
          }),
        });
      slice.forEach((invItem) => {
        const meta = itemsMeta.find((m) => m.id === invItem.item) || {
          name: invItem.item,
        };
        const hasAcquired =
          invItem.acquiredAt || invItem.createdAt || invItem.timestamp;
        const fields = [
          {
            name: message.t("commands.inventory.field_name"),
            value: `**${localizeItemName(meta.name, message.lang)}**`,
            inline: true,
          },
          {
            name: message.t("commands.inventory.field_quantity"),
            value: `\`x${invItem.amount}\``,
            inline: true,
          },
        ];
        if (hasAcquired) {
          const ts = Math.floor(Number(hasAcquired) / 1000);
          fields.push({
            name: message.t("commands.inventory.field_acquired"),
            value: `<t:${ts}:R>`,
            inline: true,
          });
        }
        embed.addFields(fields);
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
          .setCustomId("inv_prev")
          .setLabel(message.t("commands.inventory.previous"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(idx === 0),
        new ButtonBuilder()
          .setCustomId("inv_page")
          .setLabel(
            message.t("commands.inventory.page", {
              current: idx + 1,
              total: pages.length,
            }),
          )
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("inv_next")
          .setLabel(message.t("commands.inventory.next"))
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
      if (i.customId === "inv_prev" && current > 0) current--;
      else if (i.customId === "inv_next" && current < pages.length - 1)
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
