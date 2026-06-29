const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const PER_PAGE = 25;

function buildEmbed(client, message, items, page, totalPages) {
  const slice = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const embed = client.embedBuilder
    .base(client)
    .setAuthor({
      name: message.t("commands.alladmin.author", { count: items.length }),
      iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
    })
    .addFields(
      slice.map((m, i) => ({
        name: `${page * PER_PAGE + i + 1}.`,
        value: `<@${m.id}>`,
        inline: true,
      })),
    );
  if (totalPages > 1)
    embed.setFooter({
      text: message.t("commands.alladmin.page", {
        page: page + 1,
        total: totalPages,
      }),
    });
  return embed;
}

function buildRow(message, page, totalPages, userId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`alladmin_prev_${userId}`)
      .setLabel(message.t("commands.alladmin.btn_prev"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId(`alladmin_page_${userId}`)
      .setLabel(
        message.t("commands.alladmin.page", {
          page: page + 1,
          total: totalPages,
        }),
      )
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`alladmin_next_${userId}`)
      .setLabel(message.t("commands.alladmin.btn_next"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
  );
}

module.exports = {
  name: "alladmin",
  description: "Affiche tous les administrateurs du serveur",
  category: "utility",
  usage: "alladmin",
  async execute(client, message, args) {
    const admins = [
      ...message.guild.members.cache
        .filter((m) => m.permissions.has("Administrator"))
        .values(),
    ];

    if (admins.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.alladmin.no_result"),
            ),
          ],
        })
        .catch(() => {});
    }

    const totalPages = Math.ceil(admins.length / PER_PAGE);
    let page = 0;

    const reply = await message
      .reply({
        embeds: [buildEmbed(client, message, admins, page, totalPages)],
        components:
          totalPages > 1
            ? [buildRow(message, page, totalPages, message.author.id)]
            : [],
      })
      .catch(() => null);

    if (!reply || totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== message.author.id) {
        return i
          .reply({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.alladmin.author_only"),
              ),
            ],
            ephemeral: true,
          })
          .catch(() => {});
      }
      if (i.customId.startsWith("alladmin_prev_")) page = Math.max(0, page - 1);
      else if (i.customId.startsWith("alladmin_next_"))
        page = Math.min(totalPages - 1, page + 1);

      await i
        .update({
          embeds: [buildEmbed(client, message, admins, page, totalPages)],
          components: [buildRow(message, page, totalPages, message.author.id)],
        })
        .catch(() => {});
    });

    collector.on("end", () => {
      reply
        .edit({
          components: [
            buildRow(message, page, totalPages, message.author.id, true),
          ],
        })
        .catch(() => {});
    });
  },
};
