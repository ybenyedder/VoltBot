const {
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const permissions = require("../../utils/permissions");
const messageUtils = require("../../utils/messageUtils");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "warnings",
  aliases: ["warns", "avertissements"],
  description: "Affiche la liste des avertissements d'un membre.",
  category: "moderation",
  usage: "+warnings @user",
  async execute(client, message, args) {
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;

    if (
      target.id !== message.author.id &&
      !permissions.isModerator(message, client)
    ) {
      return messageUtils.sendEphemeralReply(message, {
        embeds: [client.embedBuilder.error(client, message.t("commands.warnings.permission_denied"))],
      });
    }

    const warns = client.db.getWarns(target.id, message.guild.id);

    if (!warns || warns.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .base(client, message.t("commands.warnings.title"), null)
              .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
              .addFields({
                name: message.t("commands.warnings.field_target"),
                value: `<@${target.id}>`,
                inline: true,
              })
              .setDescription(message.t("commands.warnings.none")),
          ],
        })
        .catch(() => {});
    }

    const ordered = [...warns].reverse();
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));

    const buildEmbed = (page) => {
      const start = page * pageSize;
      const slice = ordered.slice(start, start + pageSize);
      const e = client.embedBuilder
        .base(client, message.t("commands.warnings.title_user", { user: target.user.tag }), null)
        .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: message.t("commands.warnings.field_target"), value: `<@${target.id}>`, inline: true },
          { name: message.t("commands.warnings.field_total"), value: fmtNum(ordered.length), inline: true },
          {
            name: message.t("commands.warnings.field_page"),
            value: `${page + 1}/${pageCount}`,
            inline: true,
          },
        );
      slice.forEach((w) => {
        const ts = Math.floor(new Date(w.timestamp).getTime() / 1000);
        e.addFields({
          name: `#${w.id}`,
          value: `<@${w.moderatorId}> • <t:${ts}:R>\n${w.reason}`,
          inline: false,
        });
      });
      return e;
    };

    if (pageCount === 1) {
      return message.reply({ embeds: [buildEmbed(0)] }).catch(() => {});
    }

    let page = 0;
    const buildRow = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("warns_prev")
          .setLabel(message.t("commands.warnings.btn_prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("warns_page")
          .setLabel(`${page + 1}/${pageCount}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("warns_next")
          .setLabel(message.t("commands.warnings.btn_next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= pageCount - 1),
      );

    const msg = await message
      .reply({ embeds: [buildEmbed(page)], components: [buildRow()] })
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
            content: message.t("commands.warnings.buttons_author_only"),
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }
      if (i.customId === "warns_prev" && page > 0) page--;
      if (i.customId === "warns_next" && page < pageCount - 1) page++;
      await i
        .update({ embeds: [buildEmbed(page)], components: [buildRow()] })
        .catch(() => {});
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
