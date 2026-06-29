const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: "clean",
  description: "Nettoie les messages suspect (raid/spam)",
  category: "antiraid",
  usage: "clean",
  userPerms: [PermissionFlagsBits.Administrator],
  botPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    const amount = parseInt(args[0]) || 50;
    if (amount < 1 || amount > 100) {
      return message
        .reply({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.clean.amount_out_of_range"),
            ),
          ],
        })
        .catch(() => {});
    }

    const confirmEmbed = client.embedBuilder
      .warning(client, "")
      .setAuthor({
        name: message.t("commands.clean.confirm_title"),
        iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
      })
      .setDescription(null)
      .addFields(
        {
          name: message.t("commands.clean.field_channel"),
          value: `${message.channel}`,
          inline: true,
        },
        {
          name: message.t("commands.clean.field_amount"),
          value: `\`${amount}\``,
          inline: true,
        },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("clean_yes")
        .setLabel(message.t("commands.clean.btn_confirm"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("clean_no")
        .setLabel(message.t("commands.clean.btn_cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const prompt = await message
      .reply({ embeds: [confirmEmbed], components: [row] })
      .catch(() => null);
    if (!prompt) return;

    const collector = prompt.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 30000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "clean_no") {
        await i
          .update({
            embeds: [
              client.embedBuilder.info(
                client,
                message.t("commands.clean.cancelled"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
        return;
      }

      await i.deferUpdate().catch(() => {});
      try {
        await message.delete().catch(() => {});
        const messages = await message.channel.messages
          .fetch({ limit: amount })
          .catch(() => null);
        if (!messages || messages.size === 0) {
          await prompt
            .edit({
              embeds: [
                client.embedBuilder.warning(
                  client,
                  message.t("commands.clean.no_messages"),
                ),
              ],
              components: [],
            })
            .catch(() => {});
          return;
        }

        const deleted = await message.channel.bulkDelete(messages, true);

        const embed = client.embedBuilder
          .success(client, "")
          .setAuthor({
            name: message.t("commands.clean.result_title"),
            iconURL: client?.user?.displayAvatarURL?.({ size: 64 }),
          })
          .setDescription(null)
          .addFields(
            {
              name: message.t("commands.clean.field_deleted"),
              value: `\`${deleted.size}\``,
              inline: true,
            },
            {
              name: message.t("commands.clean.field_requested"),
              value: `\`${amount}\``,
              inline: true,
            },
            {
              name: message.t("commands.clean.field_moderator"),
              value: `${message.author}`,
              inline: true,
            },
          );

        await prompt.edit({ embeds: [embed], components: [] }).catch(() => {});
        setTimeout(() => prompt.delete().catch(() => {}), 5000);
      } catch (error) {
        await prompt
          .edit({
            embeds: [
              client.embedBuilder.error(
                client,
                message.t("commands.clean.failed"),
              ),
            ],
            components: [],
          })
          .catch(() => {});
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        prompt.edit({ components: [] }).catch(() => {});
      }
    });
  },
};
