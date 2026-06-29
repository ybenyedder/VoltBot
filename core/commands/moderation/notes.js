const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "notes",
  description: "Affiche les notes d'un utilisateur",
  category: "moderation",
  usage: "notes",
  userPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.notes.missing_target"),
            ),
          ],
        })
        .catch(() => {});
    }

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.notes.target_not_found"),
            ),
          ],
        })
        .catch(() => {});

    const notes = client.db.getUser(user.id, message.guild.id, "notes") || [];

    if (notes.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder
              .base(client, message.t("commands.notes.title"), null)
              .setThumbnail(user.displayAvatarURL({ size: 256 }))
              .addFields({
                name: message.t("commands.notes.field_target"),
                value: `<@${user.id}>`,
                inline: true,
              })
              .setDescription(message.t("commands.notes.no_notes")),
          ],
        })
        .catch(() => {});
    }

    const ordered = [...notes].reverse();
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));

    const buildEmbed = (page) => {
      const start = page * pageSize;
      const slice = ordered.slice(start, start + pageSize);
      const e = client.embedBuilder
        .base(
          client,
          message.t("commands.notes.title_user", { user: user.tag }),
          null,
        )
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: message.t("commands.notes.field_target"),
            value: `<@${user.id}>`,
            inline: true,
          },
          {
            name: message.t("commands.notes.field_total"),
            value: fmtNum(ordered.length),
            inline: true,
          },
          {
            name: message.t("commands.notes.field_page"),
            value: `${page + 1}/${pageCount}`,
            inline: true,
          },
        );
      slice.forEach((note) => {
        const ts = Math.floor(new Date(note.date).getTime() / 1000);
        e.addFields({
          name: `#${note.id}`,
          value: `<@${note.moderator}> • <t:${ts}:R>\n${note.content}`,
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
          .setCustomId("notes_prev")
          .setLabel(message.t("commands.notes.btn_prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("notes_page")
          .setLabel(`${page + 1}/${pageCount}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("notes_next")
          .setLabel(message.t("commands.notes.btn_next"))
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
            content: message.t("commands.notes.buttons_author_only"),
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }
      if (i.customId === "notes_prev" && page > 0) page--;
      if (i.customId === "notes_next" && page < pageCount - 1) page++;
      await i
        .update({ embeds: [buildEmbed(page)], components: [buildRow()] })
        .catch(() => {});
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
