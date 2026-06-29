const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const PER_PAGE = 25;
const BOT_ADMIN_ROLE = "BOT_ADMIN_ROLE";

function buildEmbed(client, items, page, totalPages, message) {
  const slice = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const embed = client.embedBuilder
    .base(client)
    .setAuthor({
      name: message.t("commands.snowaybots.author", { count: items.length }),
      iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
    })
    .addFields(
      slice.map((b, i) => ({
        name: `${page * PER_PAGE + i + 1}.`,
        value: `<@${b.id}>\n\`${b.id}\``,
        inline: true,
      })),
    );
  if (totalPages > 1)
    embed.setFooter({ text: message.t("commands.snowaybots.page", { current: page + 1, total: totalPages }) });
  return embed;
}

function buildRow(page, totalPages, userId, message, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`snowaybots_prev_${userId}`)
      .setLabel(message.t("commands.snowaybots.previous"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId(`snowaybots_page_${userId}`)
      .setLabel(message.t("commands.snowaybots.page", { current: page + 1, total: totalPages }))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`snowaybots_next_${userId}`)
      .setLabel(message.t("commands.snowaybots.next"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
  );
}

module.exports = {
  name: "snowaybots",
  description: "Affiche les bots sans le rôle BOT_ADMIN_ROLE",
  category: "utility",
  usage: "snowaybots",
  async execute(client, message, args) {
    const target = BOT_ADMIN_ROLE.toLowerCase();
    const bots = [
      ...message.guild.members.cache
        .filter(
          (m) =>
            m.user.bot &&
            !m.roles.cache.some((r) => r.name.toLowerCase() === target),
        )
        .values(),
    ];

    if (bots.length === 0) {
      return message
        .reply({
          embeds: [client.embedBuilder.info(client, message.t("commands.snowaybots.no_result"))],
        })
        .catch(() => {});
    }

    const totalPages = Math.ceil(bots.length / PER_PAGE);
    let page = 0;

    const reply = await message
      .reply({
        embeds: [buildEmbed(client, bots, page, totalPages, message)],
        components:
          totalPages > 1 ? [buildRow(page, totalPages, message.author.id, message)] : [],
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
              client.embedBuilder.error(client, message.t("commands.snowaybots.author_only")),
            ],
            ephemeral: true,
          })
          .catch(() => {});
      }
      if (i.customId.startsWith("snowaybots_prev_"))
        page = Math.max(0, page - 1);
      else if (i.customId.startsWith("snowaybots_next_"))
        page = Math.min(totalPages - 1, page + 1);

      await i
        .update({
          embeds: [buildEmbed(client, bots, page, totalPages, message)],
          components: [buildRow(page, totalPages, message.author.id, message)],
        })
        .catch(() => {});
    });

    collector.on("end", () => {
      reply
        .edit({
          components: [buildRow(page, totalPages, message.author.id, message, true)],
        })
        .catch(() => {});
    });
  },
};
