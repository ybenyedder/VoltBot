const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "banlist",
  description: "Affiche la liste des utilisateurs bannis du serveur.",
  category: "moderation",
  usage: "+banlist",
  userPerms: [PermissionFlagsBits.BanMembers],
  async execute(client, message, args) {
    const bans = await message.guild.bans.fetch();
    if (bans.size === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.banlist.no_bans"),
            ),
          ],
        })
        .catch(() => {});
    }

    const banArray = Array.from(bans.values());
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(banArray.length / pageSize));

    const generateEmbed = (page) => {
      const start = page * pageSize;
      const slice = banArray.slice(start, start + pageSize);
      const e = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({
          name: message.t("commands.banlist.author", {
            count: fmtNum(banArray.length),
          }),
          iconURL: client.user.displayAvatarURL(),
        })
        .setFooter({
          text: message.t("commands.banlist.footer", {
            page: page + 1,
            total: pageCount,
          }),
        });
      slice.forEach((b) => {
        const reason = b.reason
          ? b.reason.slice(0, 180)
          : message.t("commands.banlist.no_reason");
        e.addFields({
          name: b.user.tag,
          value: `<@${b.user.id}>\n${reason}`,
          inline: false,
        });
      });
      return e;
    };

    let page = 0;
    const buildRow = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("banlist_prev")
          .setLabel(message.t("commands.banlist.prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("banlist_page")
          .setLabel(`${page + 1}/${pageCount}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("banlist_next")
          .setLabel(message.t("commands.banlist.next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= pageCount - 1),
      );

    if (pageCount === 1) {
      return message.reply({ embeds: [generateEmbed(0)] }).catch(() => {});
    }

    const msg = await message
      .reply({ embeds: [generateEmbed(page)], components: [buildRow()] })
      .catch(() => null);
    if (!msg) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });
    collector.on("collect", async (i) => {
      if (i.user.id !== message.author.id) {
        return i
          .reply({
            content: message.t("commands.banlist.buttons_reserved"),
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }

      if (i.customId === "banlist_prev" && page > 0) page--;
      if (i.customId === "banlist_next" && page < pageCount - 1) page++;

      await i
        .update({
          embeds: [generateEmbed(page)],
          components: [buildRow()],
        })
        .catch(() => {});
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
