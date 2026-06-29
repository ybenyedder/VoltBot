const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const PER_PAGE = 25;

function buildEmbed(client, message, role, items, page, totalPages) {
  const slice = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const embed = client.embedBuilder
    .base(client)
    .setAuthor({
      name: `${role.name} · ${items.length}`,
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
    embed.setFooter({ text: message.t("commands.rolemembers.footer_page", { page: page + 1, total: totalPages }) });
  return embed;
}

function buildRow(message, page, totalPages, userId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rolemembers_prev_${userId}`)
      .setLabel(message.t("commands.rolemembers.btn_prev"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId(`rolemembers_page_${userId}`)
      .setLabel(message.t("commands.rolemembers.btn_page", { page: page + 1, total: totalPages }))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`rolemembers_next_${userId}`)
      .setLabel(message.t("commands.rolemembers.btn_next"))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1),
  );
}

module.exports = {
  name: "rolemembers",
  description: "Affiche tous les membres ayant un rôle spécifique",
  category: "utility",
  usage: "rolemembers",
  async execute(client, message, args) {
    if (!args[0]) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.rolemembers.role_missing"),
            ),
          ],
        })
        .catch(() => {});
    }

    const role =
      message.mentions.roles.first() ||
      message.guild.roles.cache.get(args[0]) ||
      message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === args.join(" ").toLowerCase(),
      );

    if (!role) {
      return message
        .reply({
          embeds: [client.embedBuilder.error(client, message.t("commands.rolemembers.role_not_found"))],
        })
        .catch(() => {});
    }

    const members = [...role.members.values()];

    if (members.length === 0) {
      return message
        .reply({
          embeds: [client.embedBuilder.info(client, message.t("commands.rolemembers.no_result"))],
        })
        .catch(() => {});
    }

    const totalPages = Math.ceil(members.length / PER_PAGE);
    let page = 0;

    const reply = await message
      .reply({
        embeds: [buildEmbed(client, message, role, members, page, totalPages)],
        components:
          totalPages > 1 ? [buildRow(message, page, totalPages, message.author.id)] : [],
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
              client.embedBuilder.error(client, message.t("commands.rolemembers.author_only")),
            ],
            ephemeral: true,
          })
          .catch(() => {});
      }
      if (i.customId.startsWith("rolemembers_prev_"))
        page = Math.max(0, page - 1);
      else if (i.customId.startsWith("rolemembers_next_"))
        page = Math.min(totalPages - 1, page + 1);

      await i
        .update({
          embeds: [buildEmbed(client, message, role, members, page, totalPages)],
          components: [buildRow(message, page, totalPages, message.author.id)],
        })
        .catch(() => {});
    });

    collector.on("end", () => {
      reply
        .edit({
          components: [buildRow(message, page, totalPages, message.author.id, true)],
        })
        .catch(() => {});
    });
  },
};
