const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const permissions = require("../../utils/permissions");

module.exports = {
  name: "servers",
  aliases: ["guilds", "servlist"],
  description: "Affiche la liste de tous les serveurs où le bot est présent.",
  category: "admin",
  usage: "+servers",
  ownerOnly: true,
  async execute(client, message, args) {
    const isPrimaryOwner = permissions.isPrimaryOwner(message.author.id);
    const isDbOwner = permissions.isBotOwner(client, message.author.id);

    if (!isPrimaryOwner && !isDbOwner) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.servers.no_perm"),
            ),
          ],
        })
        .catch(() => {});
    }

    const guilds = client.guilds.cache
      .map((g) => ({ name: g.name, id: g.id, members: g.memberCount || 0 }))
      .sort((a, b) => b.members - a.members);

    const fmt = new Intl.NumberFormat("fr-FR");
    const totalMembers = guilds.reduce((a, g) => a + g.members, 0);

    const perPage = 9;
    const pages = Math.max(1, Math.ceil(guilds.length / perPage));

    const buildEmbed = (page) => {
      const start = page * perPage;
      const slice = guilds.slice(start, start + perPage);
      const embed = new EmbedBuilder()
        .setColor(client.embedBuilder.getTheme(client))
        .setAuthor({
          name: message.t("commands.servers.title"),
          iconURL: client.user.displayAvatarURL(),
        })
        .setFooter({
          text: message.t("commands.servers.footer", {
            count: fmt.format(guilds.length),
            members: fmt.format(totalMembers),
            page: page + 1,
            pages,
          }),
        })
        .setTimestamp();

      if (slice.length === 0) {
        embed.setDescription(message.t("commands.servers.no_server"));
        return embed;
      }

      embed.addFields(
        slice.map((g) => ({
          name: g.name.length > 50 ? `${g.name.slice(0, 47)}...` : g.name,
          value: message.t("commands.servers.field_value", {
            members: fmt.format(g.members),
            id: g.id,
          }),
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
          .setCustomId("srv_prev")
          .setStyle(ButtonStyle.Secondary)
          .setLabel(message.t("commands.servers.btn_prev"))
          .setDisabled(disabled || current === 0),
        new ButtonBuilder()
          .setCustomId("srv_page")
          .setStyle(ButtonStyle.Secondary)
          .setLabel(`${current + 1}/${pages}`)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("srv_next")
          .setStyle(ButtonStyle.Secondary)
          .setLabel(message.t("commands.servers.btn_next"))
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
      if (interaction.customId === "srv_prev" && page > 0) page--;
      else if (interaction.customId === "srv_next" && page < pages - 1) page++;
      await interaction
        .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
        .catch(() => {});
    });

    collector.on("end", () => {
      sent.edit({ components: [buildRow(page, true)] }).catch(() => {});
    });
  },
};
