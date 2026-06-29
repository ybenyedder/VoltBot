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
      name: message.t("commands.allbotadmins.author", { count: items.length }),
      iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
    })
    .addFields(
      slice.map((id, i) => ({
        name: `${page * PER_PAGE + i + 1}.`,
        value: `<@${id}>`,
        inline: true,
      })),
    );
  if (totalPages > 1)
    embed.setFooter({
      text: message.t("commands.allbotadmins.page", {
        page: page + 1,
        total: totalPages,
      }),
    });
  return embed;
}

function buildRow(message, page, totalPages, userId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`allbotadmins_prev_${userId}`)
      .setLabel(message.t("commands.allbotadmins.btn_prev"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId(`allbotadmins_page_${userId}`)
      .setLabel(
        message.t("commands.allbotadmins.page", {
          page: page + 1,
          total: totalPages,
        }),
      )
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`allbotadmins_next_${userId}`)
      .setLabel(message.t("commands.allbotadmins.btn_next"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
  );
}

module.exports = {
  name: "allbotadmins",
  description: "Affiche tous les administrateurs de bots",
  category: "utility",
  usage: "allbotadmins",
  userPerms: ["Administrator"],
  async execute(client, message, args) {
    const botAdmins = client.db.getBotOwners() || [];
    const ids = botAdmins.map((b) => b.userId).filter(Boolean);

    if (ids.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.allbotadmins.no_result"),
            ),
          ],
        })
        .catch(() => {});
    }

    const totalPages = Math.ceil(ids.length / PER_PAGE);
    let page = 0;

    const reply = await message
      .reply({
        embeds: [buildEmbed(client, message, ids, page, totalPages)],
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
                message.t("commands.allbotadmins.author_only"),
              ),
            ],
            ephemeral: true,
          })
          .catch(() => {});
      }
      if (i.customId.startsWith("allbotadmins_prev_"))
        page = Math.max(0, page - 1);
      else if (i.customId.startsWith("allbotadmins_next_"))
        page = Math.min(totalPages - 1, page + 1);

      await i
        .update({
          embeds: [buildEmbed(client, message, ids, page, totalPages)],
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
