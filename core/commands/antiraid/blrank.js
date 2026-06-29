const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "blrank",
  description: "Affiche le classement des membres blacklist",
  category: "antiraid",
  usage: "blrank",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const blacklist = client.db.getGlobal("blacklist") || [];

    if (blacklist.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.blrank.no_blacklisted"),
            ),
          ],
        })
        .catch(() => {});
    }

    const perPage = 10;
    const pages = Math.max(1, Math.ceil(blacklist.length / perPage));
    let page = 0;

    const buildEmbed = (p) => {
      const slice = blacklist.slice(p * perPage, (p + 1) * perPage);
      const embed = client.embedBuilder
        .base(client, message.t("commands.blrank.title"))
        .setDescription(null)
        .addFields({
          name: message.t("commands.blrank.field_total"),
          value: `\`${blacklist.length}\``,
          inline: true,
        });
      embed.addFields(
        slice.map((entry, i) => ({
          name: `#${p * perPage + i + 1}`,
          value: `<@${entry.userId}> — ${entry.reason || message.t("commands.blrank.no_reason")}`,
          inline: false,
        })),
      );
      return embed;
    };

    const buildRow = (p, disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("bl_prev")
          .setLabel(message.t("commands.blrank.btn_prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || p === 0),
        new ButtonBuilder()
          .setCustomId("bl_page")
          .setLabel(message.t("commands.blrank.btn_page", { current: p + 1, total: pages }))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("bl_next")
          .setLabel(message.t("commands.blrank.btn_next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || p >= pages - 1),
      );

    const payload =
      pages > 1
        ? { embeds: [buildEmbed(page)], components: [buildRow(page)] }
        : { embeds: [buildEmbed(page)] };
    const msg = await message.reply(payload).catch(() => null);
    if (!msg || pages <= 1) return;

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 120000,
    });
    collector.on("collect", async (i) => {
      if (i.customId === "bl_prev") page = Math.max(0, page - 1);
      if (i.customId === "bl_next") page = Math.min(pages - 1, page + 1);
      await i
        .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
        .catch(() => {});
    });
    collector.on("end", () => {
      msg.edit({ components: [buildRow(page, true)] }).catch(() => {});
    });
  },
};
