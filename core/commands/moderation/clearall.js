const {
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const fmtNum = (n) => new Intl.NumberFormat("fr-FR").format(n);

module.exports = {
  name: "clearall",
  description: "Supprime tous les messages du salon",
  category: "moderation",
  usage: "clearall",
  userPerms: [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.Administrator,
  ],
  botPerms: [PermissionFlagsBits.ManageMessages],
  async execute(client, message, args) {
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("clearall_confirm")
        .setLabel(message.t("commands.clearall.btn_confirm"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("clearall_cancel")
        .setLabel(message.t("commands.clearall.btn_cancel"))
        .setStyle(ButtonStyle.Secondary),
    );

    const promptEmbed = client.embedBuilder
      .warning(client, "​")
      .setDescription(null)
      .setAuthor({ name: message.t("commands.clearall.title") })
      .addFields(
        { name: message.t("commands.clearall.field_channel"), value: `<#${message.channel.id}>`, inline: true },
        { name: message.t("commands.clearall.field_action"), value: message.t("commands.clearall.action_irreversible"), inline: true },
        { name: message.t("commands.clearall.field_delay"), value: message.t("commands.clearall.delay_value"), inline: true },
      );

    const prompt = await message
      .reply({ embeds: [promptEmbed], components: [confirmRow] })
      .catch(() => null);
    if (!prompt) return;

    let interaction;
    try {
      interaction = await prompt.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id,
        time: 30000,
      });
    } catch {
      await prompt
        .edit({
          embeds: [
            client.embedBuilder.error(client, message.t("commands.clearall.timeout")),
          ],
          components: [],
        })
        .catch(() => {});
      return;
    }

    if (interaction.customId === "clearall_cancel") {
      await interaction
        .update({
          embeds: [client.embedBuilder.info(client, message.t("commands.clearall.cancelled"))],
          components: [],
        })
        .catch(() => {});
      return;
    }

    await interaction
      .update({
        embeds: [client.embedBuilder.info(client, message.t("commands.clearall.processing_start"))],
        components: [],
      })
      .catch(() => {});

    const start = Date.now();
    try {
      let deletedCount = 0;
      let pass = 0;
      while (true) {
        let messages;
        try {
          messages = await message.channel.messages.fetch({ limit: 100 });
        } catch (e) {
          if (e && (e.status === 429 || e.code === 429)) {
            const retryMs = Math.min(
              5000,
              Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
            );
            await new Promise((r) => setTimeout(r, retryMs));
            continue;
          }
          throw e;
        }
        if (messages.size === 0) break;
        let deleted;
        try {
          deleted = await message.channel.bulkDelete(messages, true);
        } catch (e) {
          if (e && (e.status === 429 || e.code === 429)) {
            const retryMs = Math.min(
              5000,
              Math.max(500, Number(e.retry_after || e.retryAfter || 1) * 1000),
            );
            await new Promise((r) => setTimeout(r, retryMs));
            continue;
          }
          throw e;
        }
        deletedCount += deleted.size;
        pass++;
        if (deleted.size === 0) break;
        // Throttle between bulkDelete passes to spare the channel bucket
        await new Promise((r) => setTimeout(r, 500));
        if (pass % 3 === 0) {
          await prompt
            .edit({
              embeds: [
                client.embedBuilder.info(
                  client,
                  message.t("commands.clearall.processing", { count: fmtNum(deletedCount) }),
                ),
              ],
            })
            .catch(() => {});
        }
      }

      const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));
      const finalEmbed = client.embedBuilder
        .success(client, "​")
        .setDescription(null)
        .setAuthor({ name: message.t("commands.clearall.title") })
        .addFields(
          { name: message.t("commands.clearall.field_deleted"), value: fmtNum(deletedCount), inline: true },
          { name: message.t("commands.clearall.field_channel"), value: `<#${message.channel.id}>`, inline: true },
          { name: message.t("commands.clearall.field_duration"), value: message.t("commands.clearall.duration_value", { s: elapsed }), inline: true },
          {
            name: message.t("commands.clearall.field_moderator"),
            value: `<@${message.author.id}>`,
            inline: true,
          },
        );
      await prompt
        .edit({ embeds: [finalEmbed] })
        .catch(() =>
          message.channel.send({ embeds: [finalEmbed] }).catch(() => {}),
        );
    } catch (error) {
      await prompt
        .edit({
          embeds: [
            client.embedBuilder.error(
              client,
              message.t("commands.clearall.failed"),
            ),
          ],
        })
        .catch(() => {});
    }
  },
};
