const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "whitelist",
  aliases: ["wl", "liste-blanche"],
  description: "Gère la whitelist des utilisateurs protégés",
  category: "antiraid",
  usage: "whitelist",
  userPerms: [PermissionFlagsBits.Administrator],
  async execute(client, message, args) {
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === "list") {
      const whitelist = client.db.getGuild(message.guild.id, "whitelist") || [];
      const perPage = 10;
      const pages = Math.max(1, Math.ceil(whitelist.length / perPage));
      let page = 0;

      const buildEmbed = (p) => {
        const slice = whitelist.slice(p * perPage, (p + 1) * perPage);
        const embed = client.embedBuilder
          .base(client, message.t("commands.whitelist.list_title"))
          .setDescription(null)
          .addFields({
            name: message.t("commands.whitelist.field_total"),
            value: `\`${whitelist.length}\``,
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
            name: message.t("commands.whitelist.field_list"),
            value: message.t("commands.whitelist.list_empty"),
            inline: false,
          });
        }
        return embed;
      };

      const buildRow = (p, disabled = false) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("wl_prev")
            .setLabel(message.t("commands.whitelist.btn_prev"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || p === 0),
          new ButtonBuilder()
            .setCustomId("wl_page")
            .setLabel(
              message.t("commands.whitelist.btn_page", {
                current: p + 1,
                total: pages,
              }),
            )
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("wl_next")
            .setLabel(message.t("commands.whitelist.btn_next"))
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
        if (i.customId === "wl_prev") page = Math.max(0, page - 1);
        if (i.customId === "wl_next") page = Math.min(pages - 1, page + 1);
        await i
          .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
          .catch(() => {});
      });
      collector.on("end", () => {
        msg.edit({ components: [buildRow(page, true)] }).catch(() => {});
      });
      return;
    }

    if (sub === "add" && message.mentions.users.first()) {
      const user = message.mentions.users.first();
      const whitelist = client.db.getGuild(message.guild.id, "whitelist") || [];

      if (!whitelist.includes(user.id)) {
        whitelist.push(user.id);
        client.db.updateGuild(message.guild.id, { whitelist });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.whitelist.user_added", { user }),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [
            client.embedBuilder.warning(
              client,
              message.t("commands.whitelist.user_already_whitelisted"),
            ),
          ],
        })
        .catch(() => {});
    }

    if (sub === "remove" && message.mentions.users.first()) {
      const user = message.mentions.users.first();
      const whitelist = client.db.getGuild(message.guild.id, "whitelist") || [];
      const index = whitelist.indexOf(user.id);

      if (index > -1) {
        whitelist.splice(index, 1);
        client.db.updateGuild(message.guild.id, { whitelist });
        return message
          .reply({
            embeds: [
              client.embedBuilder.success(
                client,
                message.t("commands.whitelist.user_removed", { user }),
              ),
            ],
          })
          .catch(() => {});
      }
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.whitelist.user_not_whitelisted"),
            ),
          ],
        })
        .catch(() => {});
    }

    message
      .reply({
        embeds: [
          client.embedBuilder.error(
            client,
            message.t("commands.whitelist.usage", {
              p: client.config.prefix,
            }),
          ),
        ],
      })
      .catch(() => {});
  },
};
