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
  name: "vlist",
  description:
    "Affiche la liste des membres whitelistés et bannis de votre salon.",
  category: "voice",
  usage: "+vlist",
  async execute(client, message, args) {
    const vc = message.member.voice.channel;
    if (!vc)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vlist.join_private")),
          ],
        })
        .catch(() => {});
    if (!client.pvMap || !client.pvMap.has(vc.id))
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.vlist.not_private"))],
        })
        .catch(() => {});

    const pvData = client.pvMap.get(vc.id);
    if (pvData.ownerId !== message.author.id && !isOwner(message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.vlist.owner_only")),
          ],
        })
        .catch(() => {});
    }

    const wl = Array.isArray(pvData.whitelist) ? pvData.whitelist : [];
    const bl = Array.isArray(pvData.blacklist) ? pvData.blacklist : [];

    const sections = [
      { label: message.t("commands.vlist.section_whitelist"), list: wl },
      { label: message.t("commands.vlist.section_banned"), list: bl },
    ];
    const pages = [];
    for (const sec of sections) {
      if (sec.list.length === 0) {
        pages.push({ section: sec.label, slice: [], start: 0, total: 0 });
      } else {
        for (let i = 0; i < sec.list.length; i += PAGE_SIZE) {
          pages.push({
            section: sec.label,
            slice: sec.list.slice(i, i + PAGE_SIZE),
            start: i,
            total: sec.list.length,
          });
        }
      }
    }

    const totalPages = pages.length;
    const buildEmbed = (idx) => {
      const p = pages[idx];
      const embed = client.embedBuilder
        .base(client, message.t("commands.vlist.title", { section: p.section }), null)
        .addFields(
          { name: message.t("commands.vlist.field_channel"), value: `${vc}`, inline: true },
          { name: message.t("commands.vlist.field_total"), value: `\`${p.total}\``, inline: true },
        );
      if (p.slice.length === 0) {
        embed.addFields({ name: message.t("commands.vlist.field_list"), value: message.t("commands.vlist.none"), inline: false });
      } else {
        const fields = p.slice.map((id, i) => ({
          name: `#${p.start + i + 1}`,
          value: `<@${id}>`,
          inline: true,
        }));
        embed.addFields(fields);
      }
      return embed;
    };

    if (totalPages === 1) {
      return message.reply({ embeds: [buildEmbed(0)] }).catch(() => {});
    }

    let page = 0;
    const row = (p, disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("vl_prev")
          .setLabel(message.t("commands.vlist.btn_prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || p === 0),
        new ButtonBuilder()
          .setCustomId("vl_page")
          .setLabel(message.t("commands.vlist.btn_page", { current: p + 1, total: totalPages }))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("vl_next")
          .setLabel(message.t("commands.vlist.btn_next"))
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
      if (i.customId === "vl_prev" && page > 0) page--;
      else if (i.customId === "vl_next" && page < totalPages - 1) page++;
      await i
        .update({ embeds: [buildEmbed(page)], components: [row(page)] })
        .catch(() => {});
    });

    collector.on("end", () => {
      msg.edit({ components: [row(page, true)] }).catch(() => {});
    });
  },
};
