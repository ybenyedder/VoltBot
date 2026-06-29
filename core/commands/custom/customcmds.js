const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const PAGE_SIZE = 15;

const truncate = (str, max = 80) => {
  const s = String(str ?? "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

module.exports = {
  name: "customcmds",
  aliases: ["cmdlist"],
  description: "Affiche toutes les commandes personnalisées du serveur.",
  category: "custom",
  usage: "customcmds",
  async execute(client, message, args) {
    const cmds = client.db.getCustomCommands(message.guild.id);

    if (!cmds || cmds.length === 0) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.info(
              client,
              message.t("commands.customcmds.none"),
            ),
          ],
        })
        .catch(() => {});
    }

    const totalPages = Math.max(1, Math.ceil(cmds.length / PAGE_SIZE));

    const buildEmbed = (page) => {
      const slice = cmds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      const fields = slice.map((c) => ({
        name: `+${c.name}`,
        value: `\`${truncate(c.response, 80)}\``,
        inline: true,
      }));
      const embed = client.embedBuilder.base(client, null, null).setAuthor({
        name: message.t("commands.customcmds.author"),
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      });
      embed.addFields(fields);
      if (totalPages > 1) {
        embed.setFooter({ text: message.t("commands.customcmds.page", { page: page + 1, total: totalPages }) });
      }
      return embed;
    };

    if (totalPages === 1) {
      return message.reply({ embeds: [buildEmbed(0)] }).catch(() => {});
    }

    let page = 0;
    const buildRow = (current, disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ccmd_prev")
          .setLabel(message.t("commands.customcmds.btn_prev"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || current === 0),
        new ButtonBuilder()
          .setCustomId("ccmd_page")
          .setStyle(ButtonStyle.Secondary)
          .setLabel(message.t("commands.customcmds.page", { page: current + 1, total: totalPages }))
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("ccmd_next")
          .setLabel(message.t("commands.customcmds.btn_next"))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || current === totalPages - 1),
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
      if (interaction.customId === "ccmd_prev" && page > 0) page--;
      else if (interaction.customId === "ccmd_next" && page < totalPages - 1)
        page++;
      await interaction
        .update({ embeds: [buildEmbed(page)], components: [buildRow(page)] })
        .catch(() => {});
    });

    collector.on("end", () => {
      sent.edit({ components: [buildRow(page, true)] }).catch(() => {});
    });
  },
};
