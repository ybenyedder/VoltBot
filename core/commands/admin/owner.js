const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { isBotOwner } = require("../../utils/permissions");

module.exports = {
  name: "owner",
  description: "Gère les Bot Owners (accès global au bot).",
  category: "admin",
  usage: "+owner add @user | +owner remove @user | +owner list",
  ownerOnly: true,
  async execute(client, message, args) {
    if (!isBotOwner(client, message.author.id)) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.owner.no_perm"),
            ),
          ],
        })
        .catch(() => {});
    }

    const action = args[0]?.toLowerCase();

    if (!action || !["add", "remove", "list"].includes(action)) {
      const embed = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({
          name: message.t("commands.owner.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .addFields(
          { name: message.t("commands.owner.field_add"), value: "`+owner add @user`", inline: true },
          { name: message.t("commands.owner.field_remove"), value: "`+owner remove @user`", inline: true },
          { name: message.t("commands.owner.field_list"), value: "`+owner list`", inline: true },
        )
        .setFooter({ text: message.t("commands.owner.footer_global") });

      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (action === "list") {
      const owners = client.db.getBotOwners();

      const entries = [];

      const mainOwner = await client.users
        .fetch(process.env.OWNER_ID)
        .catch(() => null);
      entries.push({
        mention: `<@${process.env.OWNER_ID}>`,
        tag: mainOwner ? mainOwner.tag : message.t("commands.owner.unknown"),
        id: process.env.OWNER_ID,
        primary: true,
        addedAt: null,
      });

      for (const owner of owners) {
        const user = await client.users.fetch(owner.userId).catch(() => null);
        entries.push({
          mention: `<@${owner.userId}>`,
          tag: user ? user.tag : message.t("commands.owner.unknown"),
          id: owner.userId,
          primary: false,
          addedAt: owner.addedAt || null,
        });
      }

      const perPage = 6;
      const pages = Math.max(1, Math.ceil(entries.length / perPage));

      const buildEmbed = (page) => {
        const start = page * perPage;
        const slice = entries.slice(start, start + perPage);
        const embed = new EmbedBuilder()
          .setColor(client.embedBuilder.getTheme(client))
          .setAuthor({
            name: message.t("commands.owner.title"),
            iconURL: client.user.displayAvatarURL(),
          })
          .setFooter({
            text: message.t("commands.owner.list_footer", {
              count: entries.length,
              page: page + 1,
              pages,
            }),
          });

        if (slice.length === 0) {
          embed.setDescription(message.t("commands.owner.no_owner"));
          return embed;
        }

        embed.addFields(
          slice.map((e) => ({
            name: e.primary
              ? message.t("commands.owner.label_primary")
              : message.t("commands.owner.label_owner"),
            value:
              `${e.mention}\n\`${e.tag}\`\n\`${e.id}\`` +
              (e.addedAt
                ? "\n" +
                  message.t("commands.owner.added_at", {
                    time: Math.floor(e.addedAt / 1000),
                  })
                : ""),
            inline: true,
          })),
        );
        return embed;
      };

      if (pages === 1) {
        return message.reply({ embeds: [buildEmbed(0)] }).catch(() => {});
      }

      let page = 0;
      const buildRow = (current, disabled = false) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("own_prev")
            .setStyle(ButtonStyle.Secondary)
            .setLabel(message.t("commands.owner.btn_prev"))
            .setDisabled(disabled || current === 0),
          new ButtonBuilder()
            .setCustomId("own_page")
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`${current + 1}/${pages}`)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("own_next")
            .setStyle(ButtonStyle.Secondary)
            .setLabel(message.t("commands.owner.btn_next"))
            .setDisabled(disabled || current === pages - 1),
        );

      const sent = await message
        .reply({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
        .catch(() => null);
      if (!sent) return;

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
        filter: (i) => i.user.id === message.author.id,
      });

      collector.on("collect", async (interaction) => {
        if (interaction.customId === "own_prev" && page > 0) page--;
        else if (interaction.customId === "own_next" && page < pages - 1)
          page++;
        await interaction
          .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
          .catch(() => {});
      });

      collector.on("end", () => {
        sent.edit({ components: [buildRow(page, true)] }).catch(() => {});
      });
      return;
    }

    if (action === "add") {
      const target =
        message.mentions.users.first() ||
        (args[1] ? await client.users.fetch(args[1]).catch(() => null) : null);

      if (!target) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.owner.target_not_found"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (target.bot) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.owner.target_bot"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (target.id === process.env.OWNER_ID) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.owner.already_primary"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (client.db.isBotOwner(target.id)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.owner.already_owner"),
              ),
            ],
          })
          .catch(() => {});
      }

      client.db.addBotOwner(target.id);

      const embed = client.embedBuilder
        .success(client, message.t("commands.owner.added"))
        .addFields(
          {
            name: message.t("commands.owner.field_target"),
            value: `<@${target.id}>\n\`${target.tag}\`\n\`${target.id}\``,
            inline: true,
          },
          {
            name: message.t("commands.owner.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }

    if (action === "remove") {
      const target =
        message.mentions.users.first() ||
        (args[1] ? await client.users.fetch(args[1]).catch(() => null) : null);

      if (!target) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.owner.target_not_found"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (target.id === process.env.OWNER_ID) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.owner.primary_protected"),
              ),
            ],
          })
          .catch(() => {});
      }

      if (!client.db.isBotOwner(target.id)) {
        return message
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.owner.not_owner"),
              ),
            ],
          })
          .catch(() => {});
      }

      client.db.removeBotOwner(target.id);

      const embed = client.embedBuilder
        .success(client, message.t("commands.owner.removed"))
        .addFields(
          {
            name: message.t("commands.owner.field_target"),
            value: `<@${target.id}>\n\`${target.tag}\`\n\`${target.id}\``,
            inline: true,
          },
          {
            name: message.t("commands.owner.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );
      return message.reply({ embeds: [embed] }).catch(() => {});
    }
  },
};
