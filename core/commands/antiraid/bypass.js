const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "bypass",
  description: "Ajoute/supprime un utilisateur du bypass antiraid",
  category: "antiraid",
  usage: "bypass",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    if (!args[0] || args[0]?.toLowerCase() === "list") {
      const bypass = client.db.getGuild(message.guild.id, "bypass") || [];
      const perPage = 10;
      const pages = Math.max(1, Math.ceil(bypass.length / perPage));
      let page = 0;

      const buildEmbed = (p) => {
        const slice = bypass.slice(p * perPage, (p + 1) * perPage);
        const embed = client.embedBuilder
          .base(client, message.t("commands.bypass.title"))
          .setDescription(null)
          .addFields({
            name: message.t("commands.bypass.field_total"),
            value: `\`${bypass.length}\``,
            inline: true,
          });
        if (slice.length) {
          embed.addFields(
            slice.map((id, i) => ({
              name: `#${p * perPage + i + 1}`,
              value: `<@${id}>`,
              inline: true,
            })),
          );
        } else {
          embed.addFields({
            name: message.t("commands.bypass.field_list"),
            value: message.t("commands.bypass.no_users"),
            inline: false,
          });
        }
        return embed;
      };

      const buildRow = (p, disabled = false) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("bp_prev")
            .setLabel(message.t("commands.bypass.btn_prev"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || p === 0),
          new ButtonBuilder()
            .setCustomId("bp_page")
            .setLabel(message.t("commands.bypass.btn_page", { current: p + 1, total: pages }))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("bp_next")
            .setLabel(message.t("commands.bypass.btn_next"))
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
        if (i.customId === "bp_prev") page = Math.max(0, page - 1);
        if (i.customId === "bp_next") page = Math.min(pages - 1, page + 1);
        await i
          .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
          .catch(() => {});
      });
      collector.on("end", () => {
        msg.edit({ components: [buildRow(page, true)] }).catch(() => {});
      });
      return;
    }

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.bypass.user_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const bypass = client.db.getGuild(message.guild.id, "bypass") || [];
    const index = bypass.indexOf(user.id);

    if (index > -1) {
      bypass.splice(index, 1);
      client.db.updateGuild(message.guild.id, { bypass });
      message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.bypass.removed", { user }),
            ),
          ],
        })
        .catch(() => {});
    } else {
      bypass.push(user.id);
      client.db.updateGuild(message.guild.id, { bypass });
      message
        .reply({
          embeds: [
            client.embedBuilder.success(
              client,
              message.t("commands.bypass.added", { user }),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
