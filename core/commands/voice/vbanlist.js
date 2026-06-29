const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const isOwner = (id) =>
  !!(
    process.env.OWNER_ID &&
    process.env.OWNER_ID.split(",")
      .map((x) => x.trim())
      .includes(id)
  );

const PAGE_SIZE = 10;

module.exports = {
  name: "vbanlist",
  description: "Affiche la liste des bannis de votre salon privé.",
  category: "voice",
  usage: "+vbanlist",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vbanlist.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vbanlist.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vbanlist.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const bl = Array.isArray(pvData.blacklist) ? pvData.blacklist : [];
    const total = bl.length;

    const buildEmbed = (page) => {
      const start = page * PAGE_SIZE;
      const slice = bl.slice(start, start + PAGE_SIZE);
      const embed = client.embedBuilder
        .base(client, message.t("commands.vbanlist.title"), null)
        .addFields(
          { name: message.t("commands.vbanlist.field_channel"), value: `${vc}`, inline: true },
          { name: message.t("commands.vbanlist.field_total"), value: `\`${total}\``, inline: true },
        );

      if (total === 0) {
        embed.addFields({ name: message.t("commands.vbanlist.field_list"), value: message.t("commands.vbanlist.none"), inline: false });
      } else {
        const fields = slice.map((id, idx) => ({
          name: `#${start + idx + 1}`,
          value: `<@${id}>`,
          inline: true,
        }));
        embed.addFields(fields);
      }
      return embed;
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages === 1) {
      return message.reply({ embeds: [buildEmbed(0)] }).catch(() => {});
    }

    let page = 0;
    const row = (p, disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("vbl_prev")
          .setLabel(message.t("commands.vbanlist.btn_prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || p === 0),
        new ButtonBuilder()
          .setCustomId("vbl_page")
          .setLabel(message.t("commands.vbanlist.btn_page", { current: p + 1, total: totalPages }))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("vbl_next")
          .setLabel(message.t("commands.vbanlist.btn_next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || p === totalPages - 1),
      );

    const msg = await message
      .reply({ embeds: [buildEmbed(page)], components: [row(page)] })
      .catch(() => null);
    if (!msg) return;

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 120000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "vbl_prev" && page > 0) page--;
      else if (i.customId === "vbl_next" && page < totalPages - 1) page++;
      await i
        .update({ embeds: [buildEmbed(page)], components: [row(page)] })
        .catch(() => {});
    });

    collector.on("end", () => {
      msg.edit({ components: [row(page, true)] }).catch(() => {});
    });
  },
};
